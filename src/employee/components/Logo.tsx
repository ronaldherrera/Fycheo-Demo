import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img
      src="https://fycheo.es/brand/favicon.svg"
      alt="Fycheo"
      className={className}
    />
  );
};
