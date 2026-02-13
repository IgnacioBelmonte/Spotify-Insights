// Mock for insights repository functions
export const getTotalListeningStats = jest.fn();
export const getTopTracks = jest.fn();
export const getDailyListeningActivity = jest.fn();
export const getUserLastSyncedAt = jest.fn();
export const getListeningRhythmStats = jest.fn();
export const getDiscoveryStats = jest.fn();
export const getConsumptionProfileStats = jest.fn();
export const getContextDistributionStats = jest.fn();
export const getListenedTrackIdsByUser = jest.fn();

const insightsRepositoryMock = {
  getTotalListeningStats,
  getTopTracks,
  getDailyListeningActivity,
  getUserLastSyncedAt,
  getListeningRhythmStats,
  getDiscoveryStats,
  getConsumptionProfileStats,
  getContextDistributionStats,
  getListenedTrackIdsByUser,
};

export default insightsRepositoryMock;
