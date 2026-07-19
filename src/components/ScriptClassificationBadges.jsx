import React from 'react';
import { getCategoryIcon, getSpeedLevel, getIntensityStripe } from '../store/scriptClassification.js';

/**
 * Selos de classificação posicionados dentro de um contêiner position:relative.
 */
export default function ScriptClassificationBadges({ script, iconSize = 9, barMaxHeight = 8 }) {
  if (!script) return null;
  const icon = getCategoryIcon(script.category);
  const speedLevel = getSpeedLevel(script.speed);
  const stripe = getIntensityStripe(script.intensity);

  return (
    <>
      {icon && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 2, left: 3,
            fontSize: iconSize, lineHeight: 1, opacity: 0.85, color: 'inherit',
            pointerEvents: 'none',
          }}
        >
          {icon}
        </span>
      )}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', bottom: 5, right: 3,
          display: 'flex', alignItems: 'flex-end', gap: 1, height: barMaxHeight,
          pointerEvents: 'none',
        }}
      >
        {[1, 2, 3].map(level => (
          <span
            key={level}
            style={{
              width: 2,
              height: Math.round((level / 3) * barMaxHeight),
              background: level <= speedLevel ? 'currentColor' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: stripe.height, background: stripe.color,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
