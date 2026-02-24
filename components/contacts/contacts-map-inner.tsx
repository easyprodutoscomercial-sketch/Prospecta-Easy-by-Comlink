'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import ContactMapPopup from './contact-map-popup';
import type { MapContact } from './contacts-map-view';

interface ContactsMapInnerProps {
  contacts: MapContact[];
}

function createMarkerIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="12" fill="${color}" fill-opacity="0.85" stroke="#0f0a1e" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="#fff" fill-opacity="0.9"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Cluster icon factory
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  let size = 36;
  let bg = '#8b5cf6';
  if (count > 50) { size = 48; bg = '#10b981'; }
  else if (count > 20) { size = 42; bg = '#06b6d4'; }

  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      border-radius:50%;
      background:${bg};
      color:white;
      font-size:12px;font-weight:700;
      border:2px solid #0f0a1e;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function ContactsMapInner({ contacts }: ContactsMapInnerProps) {
  return (
    <MapContainer
      center={[-14.235, -51.925]}
      zoom={4}
      style={{ height: '100%', width: '100%', background: '#0f0a1e' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={50}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
      >
        {contacts.map((mc) => (
          <Marker
            key={mc.contact.id}
            position={mc.coords}
            icon={createMarkerIcon(mc.color)}
          >
            <Popup>
              <ContactMapPopup contact={mc.contact} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
