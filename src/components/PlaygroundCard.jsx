// src/components/PlaygroundCard.jsx
import React from 'react';

const PlaygroundCard = ({ park, onSelect }) => {
  async function sendFeedback(parkId, signalType) {
    await fetch(
      'https://script.google.com/macros/s/AKfycbzogzlAz2GRh_v0LkOE9At6EAkAVy63fNBmK8EGbAN5FP09MY91-lB1lU_1V5mJJVCG/exec',
      {
        method: 'POST',
        body: JSON.stringify({
          parkId,
          signalType,
          value: 1,
          createdAt: new Date().toISOString(),
        }),
      }
    );
  }

  const badgeStyle = {
    background: `${park.crowd?.color || '#2e7d32'}22`,
    color: park.crowd?.color || '#2e7d32',
  };

  return (
    <div className="bg-white shadow-md rounded-2xl p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-800">{park.name}</h3>
      <p className="text-sm text-gray-500">{park.address}</p>

      {/* Crowd label */}
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-2"
        style={badgeStyle}
      >
        ● {park.crowd?.label || 'Quiet'}
      </span>

      {/* Feedback buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => sendFeedback(park.id, 'quiet')}
          className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200 transition"
        >
          🌿 It’s Quiet
        </button>
        <button
          onClick={() => sendFeedback(park.id, 'busy')}
          className="px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition"
        >
          🚸 Busy Now
        </button>
      </div>

      {/* Select button */}
      <button
        onClick={() => onSelect(park)}
        className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-full text-sm transition"
      >
        View on Map
      </button>
    </div>
  );
};

export default PlaygroundCard;
