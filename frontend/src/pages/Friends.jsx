import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriends,
  listFriendRequests,
  removeFriend,
  sendFriendRequest,
} from "../api/friends";

const baseCard =
  "rounded-3xl border border-white/60 bg-white/80 p-6 shadow-md backdrop-blur-md transition-colors duration-500 dark:border-slate-800/60 dark:bg-slate-900/70";

const primaryButton =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-emerald-900 transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:text-emerald-100";

const secondaryButton =
  "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:text-slate-200";

const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "";
  }
}

function uniqById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const hasPending = useMemo(() => !!incoming.length || !!outgoing.length, [incoming.length, outgoing.length]);

  const fetchData = useCallback(async () => {
    try {
      const [friendList, requestSummary] = await Promise.all([listFriends(), listFriendRequests()]);
      setFriends(friendList || []);
      setIncoming(requestSummary?.incoming || []);
      setOutgoing(requestSummary?.outgoing || []);
      setError("");
    } catch (err) {
      const message = err?.body || err?.message || "Unable to load friends right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendRequest = async (event) => {
    event.preventDefault();
    const email = emailInput.trim();
    if (!email) {
      setError("Enter an email to send a friend request.");
      return;
    }

    setSubmitting(true);
    setNotice("");
    setError("");
    try {
      const response = await sendFriendRequest({ email });
      if (response?.auto_accepted) {
        setNotice("Request matched an incoming invite—you're friends now!");
      } else {
        setNotice("Friend request sent.");
      }
      setEmailInput("");
      await fetchData();
    } catch (err) {
      const message = err?.body || err?.message || "Unable to send friend request.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (requestId) => {
    setProcessingId(requestId);
    setError("");
    setNotice("");
    try {
      const response = await acceptFriendRequest(requestId);
      if (response?.friend) {
        setFriends((prev) => uniqById([...prev, response.friend]));
      }
      setIncoming((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      const message = err?.body || err?.message || "Unable to accept request.";
      setError(message);
      await fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId) => {
    setProcessingId(requestId);
    setError("");
    setNotice("");
    try {
      await declineFriendRequest(requestId);
      setIncoming((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      const message = err?.body || err?.message || "Unable to decline request.";
      setError(message);
      await fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (requestId) => {
    setProcessingId(requestId);
    setError("");
    setNotice("");
    try {
      await cancelFriendRequest(requestId);
      setOutgoing((prev) => prev.filter((req) => req.id !== requestId));
    } catch (err) {
      const message = err?.body || err?.message || "Unable to cancel request.";
      setError(message);
      await fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    setProcessingId(friendId);
    setError("");
    setNotice("");
    try {
      await removeFriend(friendId);
      setFriends((prev) => prev.filter((person) => person.id !== friendId));
    } catch (err) {
      const message = err?.body || err?.message || "Unable to remove friend.";
      setError(message);
      await fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading your social circle…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            onClick={() => navigate("/app")}
            className={`${buttonBase} absolute left-0 top-0 border border-emerald-200/60 bg-white/80 text-emerald-800 hover:bg-emerald-50/80 dark:border-emerald-700/40 dark:bg-slate-900/70 dark:text-emerald-200 dark:hover:bg-slate-900`}
          >
            ← Home
          </button>
          <h2 className="text-4xl font-semibold text-emerald-900 dark:text-emerald-300">Friends</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Connect with friends to stay motivated and celebrate wins together.
          </p>
        </div>
      </header>

      {(error || notice) && (
        <div className="space-y-2">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-100">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100">
              {notice}
            </div>
          ) : null}
        </div>
      )}

      <section className={baseCard}>
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">Invite a friend</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Send a request using their Magic Journal email address.
        </p>
        <form onSubmit={handleSendRequest} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="email"
            className="w-full rounded-full border border-emerald-200/70 bg-white/60 px-4 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-emerald-400"
            placeholder="friend@example.com"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            disabled={submitting}
            required
          />
          <button
            type="submit"
            className={`${primaryButton} border border-emerald-200/70 bg-emerald-200/70 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/60 dark:hover:bg-emerald-500/40`}
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </form>
      </section>

      <section className={baseCard}>
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">Pending</h3>
        {!hasPending ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No pending friend requests right now.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {incoming.length ? (
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Incoming
                </h4>
                <ul className="mt-3 space-y-3">
                  {incoming.map((req) => (
                    <li
                      key={req.id}
                      className="flex flex-col gap-3 rounded-2xl border border-emerald-200/60 bg-white/70 p-4 shadow-sm transition dark:border-emerald-500/30 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-emerald-900 dark:text-emerald-200">
                          {req.sender?.name || req.sender?.email || "Unknown user"}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{req.sender?.email}</p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          Requested {formatDate(req.requested_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleAccept(req.id)}
                          className={`${primaryButton} border border-emerald-200/70 bg-emerald-200/60 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/60 dark:hover:bg-emerald-500/40`}
                          disabled={processingId === req.id}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDecline(req.id)}
                          className={`${secondaryButton} border border-rose-200/60 bg-white/70 text-rose-600 hover:bg-rose-50 dark:border-rose-400/40 dark:bg-slate-900/70 dark:text-rose-200 dark:hover:bg-slate-900/40`}
                          disabled={processingId === req.id}
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {outgoing.length ? (
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sent
                </h4>
                <ul className="mt-3 space-y-3">
                  {outgoing.map((req) => (
                    <li
                      key={req.id}
                      className="flex flex-col gap-3 rounded-2xl border border-emerald-200/60 bg-white/70 p-4 shadow-sm transition dark:border-emerald-500/30 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-emerald-900 dark:text-emerald-200">
                          {req.receiver?.name || req.receiver?.email || "Pending user"}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{req.receiver?.email}</p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          Requested {formatDate(req.requested_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancel(req.id)}
                        className={`${secondaryButton} border border-amber-200/60 bg-white/70 text-amber-600 hover:bg-amber-50 dark:border-amber-400/40 dark:bg-slate-900/70 dark:text-amber-200 dark:hover:bg-slate-900/40`}
                        disabled={processingId === req.id}
                      >
                        Cancel request
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className={baseCard}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">Your friends</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">See who is connected to your journey.</p>
          </div>
        </div>

        {!friends.length ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No friends yet. Invite someone to get started!
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex flex-col gap-3 rounded-2xl border border-emerald-200/60 bg-white/70 p-4 shadow-sm transition dark:border-emerald-500/30 dark:bg-slate-900/60"
              >
                <div>
                  <p className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
                    {friend.name || friend.email}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{friend.email}</p>
                  {friend.since ? (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Friends since {formatDate(friend.since)}
                    </p>
                  ) : null}
                  {friend.bio ? (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{friend.bio}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  className={`${secondaryButton} self-start border border-rose-200/60 bg-white/70 text-rose-600 hover:bg-rose-50 dark:border-rose-400/40 dark:bg-slate-900/70 dark:text-rose-200 dark:hover:bg-slate-900/40`}
                  disabled={processingId === friend.id}
                >
                  Remove friend
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
