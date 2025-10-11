// src/context/UserContext.jsx
import React, { createContext, useContext, useState } from "react";

// Create the Context
const UserContext = createContext();

// Create the Provider component
export function UserProvider({ children }) {
  // Global filters state (shared between Welcome + Map)
  const [filters, setFilters] = useState({
    fenced: null,
    dogs: null,
    bathrooms: null,
    shade: null,
    parking: null,
    lighting: null,
  });

  // Optional: store location or other info later
  const [userLocation, setUserLocation] = useState(null);

  return (
    <UserContext.Provider
      value={{
        filters,
        setFilters,
        userLocation,
        setUserLocation,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Custom hook for easy use in components
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used inside a UserProvider");
  }
  return context;
}
