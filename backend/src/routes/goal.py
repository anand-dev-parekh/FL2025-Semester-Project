from flask import request, jsonify, Blueprint
from tools.auth_helper import ensure_auth
from tools.database import db_pool
from tools.healthkit_goal_helper import HEALTH_METRIC_KEYS, metric_for_habit_name, metric_unit

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
                    g.uses_healthkit,
                    g.health_metric,
                    g.target_value,
                    g.target_unit,
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
                "uses_healthkit": r[5],
                "health_metric": r[6],
                "target_value": r[7],
                "target_unit": r[8],
                "habit_id": r[9],
                "habit": {
                    "id": r[9],
                    "name": r[10],
                    "description": r[11],
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
    uses_healthkit = bool(data.get("uses_healthkit", False))
    target_value = data.get("target_value")
    target_unit = (data.get("target_unit") or "").strip() or None
    health_metric = (data.get("health_metric") or "").strip() or None

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

    if target_value is not None:
        try:
            target_value = int(target_value)
        except (TypeError, ValueError):
            return jsonify({"error": "target_value must be an integer"}), 400
        if target_value < 0:
            return jsonify({"error": "target_value must be zero or greater"}), 400

    conn = db_pool.getconn()
    try:
        with conn:  # commit/rollback
            with conn.cursor() as cur:
                # ensure habit exists (optional but nicer error)
                cur.execute("SELECT id, name, description FROM habits WHERE id = %s", (habit_id,))
                hrow = cur.fetchone()
                if not hrow:
                    return jsonify({"error": "Habit not found"}), 404

                habit_name = hrow[1]
                default_metric = metric_for_habit_name(habit_name)
                if uses_healthkit:
                    # Fall back to habit's default metric if caller didn't specify one.
                    if not health_metric:
                        health_metric = default_metric
                    if health_metric not in HEALTH_METRIC_KEYS:
                        return jsonify({"error": "health_metric is invalid"}), 400
                    if target_value is None:
                        return jsonify({"error": "target_value is required for HealthKit goals"}), 400
                    if not target_unit:
                        target_unit = metric_unit(health_metric)
                else:
                    health_metric = None
                    target_value = target_value if target_value is not None else None
                    target_unit = target_unit if target_unit is not None else None

                # insert goal and return joined record
                cur.execute("""
                    WITH ins AS (
                        INSERT INTO goals (user_id, habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, user_id, habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit, created_at
                    )
                    SELECT 
                        ins.id, ins.goal_text, ins.xp, ins.completed, ins.created_at,
                        ins.uses_healthkit, ins.health_metric, ins.target_value, ins.target_unit,
                        h.id AS habit_id, h.name AS habit_name, h.description AS habit_description
                    FROM ins
                    JOIN habits h ON h.id = ins.habit_id;
                """, (user["id"], habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit))
                r = cur.fetchone()

        goal = {
            "id": r[0],
            "goal_text": r[1],
            "xp": r[2],
            "completed": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
            "uses_healthkit": r[5],
            "health_metric": r[6],
            "target_value": r[7],
            "target_unit": r[8],
            "habit_id": r[9],
            "habit": {"id": r[9], "name": r[10], "description": r[11]},
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

    if "uses_healthkit" in data:
        updates["uses_healthkit"] = bool(data.get("uses_healthkit"))

    if "health_metric" in data:
        metric = (data.get("health_metric") or "").strip() or None
        if metric and metric not in HEALTH_METRIC_KEYS:
            return jsonify({"error": "health_metric is invalid"}), 400
        updates["health_metric"] = metric

    if "target_value" in data:
        target_val = data.get("target_value")
        if target_val is None:
            updates["target_value"] = None
        else:
            try:
                target_int = int(target_val)
            except (TypeError, ValueError):
                return jsonify({"error": "target_value must be an integer"}), 400
            if target_int < 0:
                return jsonify({"error": "target_value must be zero or greater"}), 400
            updates["target_value"] = target_int

    if "target_unit" in data:
        target_unit = (data.get("target_unit") or "").strip() or None
        updates["target_unit"] = target_unit

    if not updates:
        return jsonify({"error": "No fields to update"}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Load current goal and habit for validation and defaults
                cur.execute(
                    """
                    SELECT g.user_id, g.habit_id, g.uses_healthkit, g.health_metric, g.target_value, g.target_unit, h.name
                    FROM goals g
                    JOIN habits h ON h.id = g.habit_id
                    WHERE g.id = %s
                    """,
                    (goal_id,),
                )
                existing = cur.fetchone()
                if not existing or existing[0] != user["id"]:
                    return jsonify({"error": "Goal not found"}), 404

                current_habit_id = existing[1]
                current_uses_healthkit = existing[2]
                current_metric = existing[3]
                current_target_value = existing[4]
                current_target_unit = existing[5]
                current_habit_name = existing[6]

                target_habit_id = updates.get("habit_id", current_habit_id)
                # Validate habit if changing it, and fetch its name for metric defaults
                if target_habit_id != current_habit_id:
                    cur.execute("SELECT id, name FROM habits WHERE id = %s", (target_habit_id,))
                    habit_row = cur.fetchone()
                    if not habit_row:
                        return jsonify({"error": "Habit not found"}), 404
                    target_habit_name = habit_row[1]
                else:
                    target_habit_name = current_habit_name

                default_metric = metric_for_habit_name(target_habit_name)
                uses_healthkit = updates.get("uses_healthkit", current_uses_healthkit)
                target_metric = updates.get("health_metric", current_metric)
                target_value = updates.get("target_value", current_target_value)
                target_unit = updates.get("target_unit", current_target_unit)

                if uses_healthkit:
                    if not target_metric:
                        target_metric = default_metric
                    if target_metric not in HEALTH_METRIC_KEYS:
                        return jsonify({"error": "health_metric is invalid"}), 400
                    if target_value is None:
                        return jsonify({"error": "target_value is required for HealthKit goals"}), 400
                    if not target_unit:
                        target_unit = metric_unit(target_metric)
                else:
                    target_metric = None
                    target_value = None
                    target_unit = target_unit if target_unit is not None else None

                updates["uses_healthkit"] = uses_healthkit
                updates["health_metric"] = target_metric
                updates["target_value"] = target_value
                updates["target_unit"] = target_unit

                # Validate habit if changing it
                if target_habit_id != current_habit_id:
                    updates["habit_id"] = target_habit_id

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
                    RETURNING id, habit_id, goal_text, xp, completed, uses_healthkit, health_metric, target_value, target_unit, created_at
                    """,
                    params,
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Goal not found"}), 404

                goal_id_out = row[0]
                habit_id_out = row[1]
                goal_text_out = row[2]
                xp_out = row[3]
                completed_out = row[4]
                uses_healthkit_out = row[5]
                health_metric_out = row[6]
                target_value_out = row[7]
                target_unit_out = row[8]
                created_at_out = row[9]

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
            "uses_healthkit": uses_healthkit_out,
            "health_metric": health_metric_out,
            "target_value": target_value_out,
            "target_unit": target_unit_out,
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
