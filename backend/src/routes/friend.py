from flask import request, jsonify, Blueprint
from tools.auth_helper import session_user
from tools.database import db_pool

friend_blueprint = Blueprint("friends", __name__, url_prefix="/api/friends")


def _ensure_auth():
    user = session_user()
    if not user or not user.get("id"):
        return None, (jsonify({"error": "Unauthorized"}), 401)
    return user, None


def _build_user_payload(row):
    return {
        "id": row[0],
        "email": row[1],
        "name": row[2],
        "bio": row[3],
    }


@friend_blueprint.route("", methods=["GET"])
def get_friends():
    user, error = _ensure_auth()
    if error:
        return error

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    CASE
                        WHEN f.user_id1 = %s THEN f.user_id2
                        ELSE f.user_id1
                    END AS friend_id,
                    u.email,
                    u.name,
                    u.bio,
                    f.since
                FROM friends f
                JOIN users u
                  ON u.id = CASE WHEN f.user_id1 = %s THEN f.user_id2 ELSE f.user_id1 END
                WHERE f.user_id1 = %s OR f.user_id2 = %s
                ORDER BY u.name NULLS LAST, u.email
                """,
                (user["id"], user["id"], user["id"], user["id"]),
            )
            rows = cur.fetchall()

        friends = [
            {
                "id": row[0],
                "email": row[1],
                "name": row[2],
                "bio": row[3],
                "since": row[4].isoformat() if row[4] else None,
            }
            for row in rows
        ]
        return jsonify(friends)
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/requests", methods=["GET"])
def get_friend_requests():
    user, error = _ensure_auth()
    if error:
        return error

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    fr.id,
                    fr.sender_id,
                    fr.receiver_id,
                    fr.status,
                    fr.requested_at,
                    s.id,
                    s.email,
                    s.name,
                    s.bio,
                    r.id,
                    r.email,
                    r.name,
                    r.bio
                FROM friend_requests fr
                JOIN users s ON s.id = fr.sender_id
                JOIN users r ON r.id = fr.receiver_id
                WHERE (fr.sender_id = %s OR fr.receiver_id = %s)
                  AND fr.status = 'pending'
                ORDER BY fr.requested_at DESC
                """,
                (user["id"], user["id"]),
            )
            rows = cur.fetchall()

        incoming = []
        outgoing = []

        for row in rows:
            payload = {
                "id": row[0],
                "status": row[3],
                "requested_at": row[4].isoformat() if row[4] else None,
            }
            sender = _build_user_payload(row[5:9])
            receiver = _build_user_payload(row[9:13])
            if row[1] == user["id"]:
                payload["receiver"] = receiver
                outgoing.append(payload)
            else:
                payload["sender"] = sender
                incoming.append(payload)

        return jsonify({"incoming": incoming, "outgoing": outgoing})
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/requests", methods=["POST"])
def send_friend_request():
    user, error = _ensure_auth()
    if error:
        return error

    data = request.get_json(silent=True) or {}

    target_id = data.get("user_id")
    target_email = (data.get("email") or "").strip().lower()

    if target_id is None and not target_email:
        return jsonify({"error": "Provide user_id or email"}), 400

    try:
        target_id = int(target_id) if target_id is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "user_id must be an integer"}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if target_id is not None:
                    cur.execute(
                        "SELECT id, email, name, bio FROM users WHERE id = %s",
                        (target_id,),
                    )
                else:
                    cur.execute(
                        "SELECT id, email, name, bio FROM users WHERE lower(email) = %s",
                        (target_email,),
                    )
                target_row = cur.fetchone()
                if not target_row:
                    return jsonify({"error": "User not found"}), 404

                target_user = _build_user_payload(target_row)
                target_id = target_user["id"]

                if target_id == user["id"]:
                    return jsonify({"error": "Cannot send a friend request to yourself"}), 400

                low_id = min(user["id"], target_id)
                high_id = max(user["id"], target_id)

                cur.execute(
                    """
                    SELECT 1
                    FROM friends
                    WHERE user_id1 = %s AND user_id2 = %s
                    """,
                    (low_id, high_id),
                )
                if cur.fetchone():
                    return jsonify({"error": "Already friends"}), 409

                cur.execute(
                    """
                    SELECT id, sender_id, receiver_id, status
                    FROM friend_requests
                    WHERE (sender_id = %s AND receiver_id = %s)
                       OR (sender_id = %s AND receiver_id = %s)
                    FOR UPDATE
                    """,
                    (user["id"], target_id, target_id, user["id"]),
                )
                rows = cur.fetchall()

                incoming = None
                outgoing = None
                for row in rows:
                    if row[1] == user["id"]:
                        outgoing = row
                    else:
                        incoming = row

                if incoming and incoming[3] == "pending":
                    # Auto-accept the existing incoming request.
                    cur.execute(
                        "UPDATE friend_requests SET status = 'accepted' WHERE id = %s",
                        (incoming[0],),
                    )

                    cur.execute(
                        """
                        INSERT INTO friends (user_id1, user_id2)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (low_id, high_id),
                    )
                    cur.execute(
                        """
                        SELECT since
                        FROM friends
                        WHERE user_id1 = %s AND user_id2 = %s
                        """,
                        (low_id, high_id),
                    )
                    since_row = cur.fetchone()
                    friend_payload = {
                        "id": target_user["id"],
                        "email": target_user["email"],
                        "name": target_user["name"],
                        "bio": target_user["bio"],
                        "since": since_row[0].isoformat() if since_row and since_row[0] else None,
                    }
                    return (
                        jsonify(
                            {
                                "friend": friend_payload,
                                "request_id": incoming[0],
                                "status": "accepted",
                                "auto_accepted": True,
                            }
                        ),
                        200,
                    )

                if outgoing and outgoing[3] == "pending":
                    return jsonify({"error": "Friend request already pending"}), 409

                if outgoing:
                    cur.execute(
                        """
                        UPDATE friend_requests
                        SET status = 'pending', requested_at = now()
                        WHERE id = %s
                        RETURNING id, status, requested_at
                        """,
                        (outgoing[0],),
                    )
                    req_row = cur.fetchone()
                else:
                    cur.execute(
                        """
                        INSERT INTO friend_requests (sender_id, receiver_id)
                        VALUES (%s, %s)
                        RETURNING id, status, requested_at
                        """,
                        (user["id"], target_id),
                    )
                    req_row = cur.fetchone()

        request_payload = {
            "id": req_row[0],
            "status": req_row[1],
            "requested_at": req_row[2].isoformat() if req_row[2] else None,
            "sender": {
                "id": user["id"],
                "email": user.get("email"),
                "name": user.get("name"),
            },
            "receiver": target_user,
        }
        return jsonify(request_payload), 201
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/requests/<int:request_id>/accept", methods=["POST"])
def accept_friend_request(request_id):
    user, error = _ensure_auth()
    if error:
        return error

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sender_id, receiver_id, status
                    FROM friend_requests
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    (request_id,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Friend request not found"}), 404

                if row[2] != user["id"]:
                    return jsonify({"error": "Not allowed"}), 403

                if row[3] != "pending":
                    return jsonify({"error": "Friend request is not pending"}), 400

                cur.execute(
                    "UPDATE friend_requests SET status = 'accepted' WHERE id = %s",
                    (request_id,),
                )

                low_id = min(user["id"], row[1])
                high_id = max(user["id"], row[1])

                cur.execute(
                    """
                    INSERT INTO friends (user_id1, user_id2)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (low_id, high_id),
                )
                cur.execute(
                    """
                    SELECT since
                    FROM friends
                    WHERE user_id1 = %s AND user_id2 = %s
                    """,
                    (low_id, high_id),
                )
                since_row = cur.fetchone()

                cur.execute(
                    "SELECT id, email, name, bio FROM users WHERE id = %s",
                    (row[1],),
                )
                friend_row = cur.fetchone()

        friend_payload = {
            "id": friend_row[0],
            "email": friend_row[1],
            "name": friend_row[2],
            "bio": friend_row[3],
            "since": since_row[0].isoformat() if since_row and since_row[0] else None,
        }
        return jsonify({"friend": friend_payload, "request_id": request_id, "status": "accepted"})
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/requests/<int:request_id>/decline", methods=["POST"])
def decline_friend_request(request_id):
    user, error = _ensure_auth()
    if error:
        return error

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sender_id, receiver_id, status
                    FROM friend_requests
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    (request_id,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Friend request not found"}), 404

                if row[2] != user["id"]:
                    return jsonify({"error": "Not allowed"}), 403

                if row[3] != "pending":
                    return jsonify({"error": "Friend request is not pending"}), 400

                cur.execute(
                    "UPDATE friend_requests SET status = 'declined' WHERE id = %s",
                    (request_id,),
                )

        return jsonify({"request_id": request_id, "status": "declined"})
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/requests/<int:request_id>/cancel", methods=["POST"])
def cancel_friend_request(request_id):
    user, error = _ensure_auth()
    if error:
        return error

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sender_id, receiver_id, status
                    FROM friend_requests
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    (request_id,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Friend request not found"}), 404

                if row[1] != user["id"]:
                    return jsonify({"error": "Not allowed"}), 403

                if row[3] != "pending":
                    return jsonify({"error": "Friend request is not pending"}), 400

                cur.execute(
                    "UPDATE friend_requests SET status = 'cancelled' WHERE id = %s",
                    (request_id,),
                )

        return jsonify({"request_id": request_id, "status": "cancelled"})
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/<int:friend_user_id>", methods=["DELETE"])
def delete_friend(friend_user_id):
    user, error = _ensure_auth()
    if error:
        return error

    if friend_user_id == user["id"]:
        return jsonify({"error": "Cannot unfriend yourself"}), 400

    conn = db_pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                low_id = min(user["id"], friend_user_id)
                high_id = max(user["id"], friend_user_id)

                cur.execute(
                    """
                    DELETE FROM friends
                    WHERE user_id1 = %s AND user_id2 = %s
                    RETURNING user_id1
                    """,
                    (low_id, high_id),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Friend relationship not found"}), 404

                cur.execute(
                    """
                    UPDATE friend_requests
                    SET status = 'cancelled'
                    WHERE status = 'accepted'
                      AND (
                           (sender_id = %s AND receiver_id = %s)
                           OR (sender_id = %s AND receiver_id = %s)
                      )
                    """,
                    (user["id"], friend_user_id, friend_user_id, user["id"]),
                )

        return ("", 204)
    finally:
        db_pool.putconn(conn)


@friend_blueprint.route("/<int:friend_id>/habits", methods=["GET"])
def get_friend_habits(friend_id):
    user, error = _ensure_auth()
    if error:
        return error

    if friend_id == user["id"]:
        return jsonify({"error": "Friend ID must be different from your user ID"}), 400

    low_id = min(user["id"], friend_id)
    high_id = max(user["id"], friend_id)

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1
                FROM friends
                WHERE user_id1 = %s AND user_id2 = %s
                """,
                (low_id, high_id),
            )
            if not cur.fetchone():
                return jsonify({"error": "You can only view habits for confirmed friends."}), 403

            cur.execute(
                """
                SELECT id, email, name, bio
                FROM users
                WHERE id = %s
                """,
                (friend_id,),
            )
            friend_row = cur.fetchone()
            if not friend_row:
                return jsonify({"error": "Friend not found"}), 404

            cur.execute(
                """
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
                JOIN habits h ON h.id = g.habit_id
                WHERE g.user_id = %s
                ORDER BY h.name NULLS LAST, g.created_at DESC
                """,
                (friend_id,),
            )
            rows = cur.fetchall()

        goals = [
            {
                "id": row[0],
                "goal_text": row[1],
                "xp": row[2],
                "completed": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "habit_id": row[5],
                "habit": {
                    "id": row[5],
                    "name": row[6],
                    "description": row[7],
                },
            }
            for row in rows
        ]

        return jsonify(
            {
                "friend": _build_user_payload(friend_row),
                "goals": goals,
            }
        )
    finally:
        db_pool.putconn(conn)
