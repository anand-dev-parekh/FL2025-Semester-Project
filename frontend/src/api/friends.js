import { http } from './http';

export function listFriends() {
  return http('/api/friends');
}

export function listFriendRequests() {
  return http('/api/friends/requests');
}

export function sendFriendRequest(body) {
  return http('/api/friends/requests', {
    method: 'POST',
    body,
  });
}

export function acceptFriendRequest(requestId) {
  return http(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
}

export function declineFriendRequest(requestId) {
  return http(`/api/friends/requests/${requestId}/decline`, { method: 'POST' });
}

export function cancelFriendRequest(requestId) {
  return http(`/api/friends/requests/${requestId}/cancel`, { method: 'POST' });
}

export function removeFriend(friendUserId) {
  return http(`/api/friends/${friendUserId}`, { method: 'DELETE' });
}

export function getFriendHabits(friendUserId) {
  return http(`/api/friends/${friendUserId}/habits`);
}
