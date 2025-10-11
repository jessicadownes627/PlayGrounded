import React from 'react';

export default function FilterBar({ radiusMiles, onRadiusChange, filters, onFiltersChange }) {
  const set = (key, val) => onFiltersChange({ ...filters, [key]: val });

  return (
    <>
      <button className="btn" onClick={() => onRadiusChange(10)}>Nearby (10mi)</button>
      <button className="btn" onClick={() => onRadiusChange(15)}>Wider (15mi)</button>
      <button className="btn" onClick={() => onRadiusChange(25)}>Explore (25mi)</button>

      <button className="btn" onClick={() => set('fenced', filters.fenced === true ? null : true)}>
        {filters.fenced ? 'Fenced ✅' : 'Fenced'}
      </button>
      <button className="btn" onClick={() => set('dogs', filters.dogs === true ? null : true)}>
        {filters.dogs ? 'Dogs Allowed 🐶' : 'Dogs Allowed'}
      </button>
      <button className="btn" onClick={() => set('bathrooms', filters.bathrooms === true ? null : true)}>
        {filters.bathrooms ? 'Bathrooms 🚻' : 'Bathrooms'}
      </button>
    </>
  );
}
