from flask import request, jsonify, Blueprint
from tools.auth_helper import ensure_auth
from tools.database import db_pool 

goal_blueprint = Blueprint("goals", __name__, url_prefix="/api/goals")

@goal_blueprint.route("", methods=["GET"])
def get_goals():
    user, error = ensure_auth()
    if error:
        return error
    
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    g.id,
                    g.goal_text,
                    g.xp,
                    g.completed,
                    g.created_at,
                    h.id AS habit_id,
                    h.name AS habit_name,
                    h.description AS habit_description
                FROM goals g
                JOIN habits h ON g.habit_id = h.id
                WHERE g.user_id = %s
                ORDER BY g.created_at DESC;
            """, (user["id"],))
            
            rows = cur.fetchall()

        goals = [
            {
                "id": r[0],
                "goal_text": r[1],
                "xp": r[2],
                "completed": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
                "habit_id": r[5],
                "habit": {
                    "id": r[5],
                    "name": r[6],
                    "description": r[7],
                },
            }
            for r in rows
        ]
        return jsonify(goals)
    finally:
        db_pool.putconn(conn)

# -------- POST /api/goals (create) --------
@goal_blueprint.route("", methods=["POST"])
def create_goal():
    user, error = ensure_auth()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    habit_id = data.get("habit_id")
    goal_text = (data.get("goal_text") or "").strip()
    xp = data.get("xp", 0)
    completed = data.get("completed", False)

    # basic validation
    if not habit_id or not isinstance(habit_id, int):
        return jsonify({"error": "habit_id (int) is required"}), 400
    if not goal_text:
        return jsonify({"error": "goal_text is required"}), 400
    try:
        xp = int(xp)
    except (TypeError, ValueError):
        return jsonify({"error": "xp must be an integer"}), 400
    completed = bool(completed)

    conn = db_pool.getconn()
    try:
        with conn:  # commit/rollback
            with conn.cursor() as cur:
                # ensure habit exists (optional but nicer error)
                cur.execute("SELECT id, name, description FROM habits WHERE id = %s", (habit_id,))
                hrow = cur.fetchone()
                if not hrow:
                    return jsonify({"error": "Habit not found"}), 404

                # insert goal and return joined record
                cur.execute("""
                    WITH ins AS (
                        INSERT INTO goals (user_id, habit_id, goal_text, xp, completed)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, user_id, habit_id, goal_text, xp, completed, created_at
                    )
                    SELECT 
                        ins.id, ins.goal_text, ins.xp, ins.completed, ins.created_at,
                        h.id AS habit_id, h.name AS habit_name, h.description AS habit_description
                    FROM ins
                    JOIN habits h ON h.id = ins.habit_id;
                """, (user["id"], habit_id, goal_text, xp, completed))
                r = cur.fetchone()

        goal = {
            "id": r[0],
            "goal_text": r[1],
            "xp": r[2],
            "completed": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
            "habit_id": r[5],
            "habit": {"id": r[5], "name": r[6], "description": r[7]},
        }
        return jsonify(goal), 201
    finally:
        db_pool.putconn(conn)

# -------- PATCH /api/goals/<goal_id> (update, simplified) --------
@goal_blueprint.route("/<int:goal_id>", methods=["PATCH"])
def update_goal(goal_id):
    user, error = ensure_auth()
    if error:
        return error

    data = request.get_json(silent=True) or {}

    # Whitelist + light validation
    updates = {}
    if "goal_text" in data:
        txt = (data.get("goal_text") or "").strip()
        if txt == "":
            return jsonify({"error": "goal_text cannot be empty"}), 400
        updates["goal_text"] = txt

    if "xp" in data:
        try:
            updates["xp"] = int(data["xp"])
        except (TypeError, ValueError):
            return jsonify({"error": "xp must be an integer"}), 400

    if "completed" in data:
        updates["completed"] = bool(data["completed"])

    if "habit_id" in data:
        hid = data["habit_id"]
        if not isinstance(hid, int):
            return jsonify({"error": "habit_id must be an integer"}), 400
        updates["habit_id"] = hid

    if not updates:
        return jsonify({"error": "No fields to update"}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Validate habit if changing it
                if "habit_id" in updates:
                    cur.execute("SELECT 1 FROM habits WHERE id = %s", (updates["habit_id"],))
                    if not cur.fetchone():
                        return jsonify({"error": "Habit not found"}), 404

                # Build SET clause from the safe whitelist
                fields = list(updates.keys())
                set_sql = ", ".join(f"{col} = %s" for col in fields)
                params = [updates[col] for col in fields] + [goal_id, user["id"]]

                # Update and get the updated goal (without join—keep it simple)
                cur.execute(
                    f"""
                    UPDATE goals
                    SET {set_sql}
                    WHERE id = %s AND user_id = %s
                    RETURNING id, habit_id, goal_text, xp, completed, created_at
                    """,
                    params,
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Goal not found"}), 404

                goal_id_out, habit_id_out, goal_text_out, xp_out, completed_out, created_at_out = row

                # Fetch habit for the response payload
                cur.execute(
                    "SELECT id, name, description FROM habits WHERE id = %s",
                    (habit_id_out,),
                )
                h = cur.fetchone()

        goal = {
            "id": goal_id_out,
            "goal_text": goal_text_out,
            "xp": xp_out,
            "completed": completed_out,
            "created_at": created_at_out.isoformat() if created_at_out else None,
            "habit_id": h[0] if h else habit_id_out,
            "habit": {
                "id": h[0],
                "name": h[1],
                "description": h[2],
            } if h else None,
        }
        return jsonify(goal)
    finally:
        db_pool.putconn(conn)

# -------- DELETE /api/goals/<goal_id> --------
@goal_blueprint.route("/<int:goal_id>", methods=["DELETE"])
def delete_goal(goal_id):
    user, error = ensure_auth()
    if error:
        return error

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM goals WHERE id = %s AND user_id = %s RETURNING id",
                    (goal_id, user["id"])
                )
                r = cur.fetchone()
                if not r:
                    return jsonify({"error": "Goal not found"}), 404
        # No body needed; 204 is conventional for DELETE success
        return ("", 204)
    finally:
        db_pool.putconn(conn)
