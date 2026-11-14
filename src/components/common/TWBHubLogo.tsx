
import React from 'react';

interface TWBHubLogoProps {
  className?: string;
}

const APERTURE_WEDGE_PATH =
  'M 24.65 37.30 L 54.21 37.30 L 45.40 22.03 A 28.35 28.35 0 0 0 24.65 37.30 Z';

export const TWBHubLogo: React.FC<TWBHubLogoProps> = ({
  className = 'w-8 h-8',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    role="img"
    aria-label="TWBHub logo"
    className={className}
  >
    {/* Champagne-gold outer square */}
    <rect
      x="0"
      y="0"
      width="100"
      height="100"
      rx="16.5"
      fill="#F2D099"
    />

    {/* Chocolate-brown circular ring */}
    <circle cx="50" cy="50" r="45.7" fill="#493522" />

    {/* Champagne-gold inner circle */}
    <circle cx="50" cy="50" r="32.3" fill="#F2D099" />

    {/* Chocolate-brown six-blade aperture */}
    <g fill="#493522">
      <path d={APERTURE_WEDGE_PATH} />
      <path d={APERTURE_WEDGE_PATH} transform="rotate(60 50 50)" />
      <path d={APERTURE_WEDGE_PATH} transform="rotate(120 50 50)" />
      <path d={APERTURE_WEDGE_PATH} transform="rotate(180 50 50)" />
      <path d={APERTURE_WEDGE_PATH} transform="rotate(240 50 50)" />
      <path d={APERTURE_WEDGE_PATH} transform="rotate(300 50 50)" />
    </g>
  </svg>
);
