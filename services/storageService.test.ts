// Updated mock objects and tests to match percentage-based scaling
import { describe, it, expect, beforeEach, vi } from 'vitest';
// Fix: Removed non-existent export 'getCompletedSubjectNames' from './storageService' imports as it is unused and not exported.
import { saveFeedback, getHistory, getSubjectStats } from './storageService';
import { FeedbackData } from '../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { store = {}; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('storageService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const mockFeedback: FeedbackData = {
    subject: "Algorithmique et Programmation C",
    q1: 100, q2: 75, q3: 50, q4: 25, q5: 100,
    q6_jobs: "Oui",
    q7_rooms: 75,
    q8_resources: 50,
    q9_transport: "Bus",
    q10_laptop: "Oui",
    comments: "Test comment"
  };

  it('should save feedback entry and retrieve history', () => {
    saveFeedback(mockFeedback);
    const history = getHistory();
    
    expect(history.length).toBe(1);
    expect(history[0].subject).toBe(mockFeedback.subject);
    expect(history[0].q7_rooms).toBe(75);
  });

  it('should calculate correct average stats for a module', () => {
    saveFeedback({ ...mockFeedback, q1: 100, q2: 100, q3: 100, q4: 100, q5: 100 });
    saveFeedback({ ...mockFeedback, q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
    
    const stats = getSubjectStats(mockFeedback.subject);
    
    expect(stats).not.toBeNull();
    if (stats) {
      expect(stats.totalEntries).toBe(2);
      expect(stats.averageScore).toBe(50);
    }
  });

  it('should handle environmental diagnostic with percentage values correctly', () => {
    const envFeedback: FeedbackData = {
      subject: "ENVIRONNEMENT_GLOBAL",
      q1: null, q2: null, q3: null, q4: null, q5: null,
      q6_jobs: "Oui",
      q7_rooms: 100,
      q8_resources: 25,
      q9_transport: "Taxi",
      q10_laptop: "Non",
      comments: ""
    };

    saveFeedback(envFeedback);
    const stats = getSubjectStats(envFeedback.subject);
    
    expect(stats).not.toBeNull();
    if (stats) {
      expect(stats.qAverages.q7_rooms).toBe(100);
      expect(stats.qAverages.q8_resources).toBe(25);
    }
  });
});