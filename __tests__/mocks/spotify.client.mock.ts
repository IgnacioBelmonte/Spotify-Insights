/* eslint-disable import/no-anonymous-default-export */

// Centralized Spotify client mock
export const exchangeCodeForToken = jest.fn();
export const fetchSpotifyMe = jest.fn();
export const refreshAccessToken = jest.fn();

export default { exchangeCodeForToken, fetchSpotifyMe, refreshAccessToken };
