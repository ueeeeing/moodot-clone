export type LeafletLatLng = { lat: number; lng: number }

export type LeafletClickEvent = { latlng: LeafletLatLng }

export type LeafletMap = {
  setView(latlng: [number, number], zoom: number): LeafletMap
  on(event: "click", handler: (event: LeafletClickEvent) => void): void
  invalidateSize(): void
  remove(): void
}

export type LeafletMarker = {
  addTo(map: LeafletMap): LeafletMarker
  setLatLng(latlng: [number, number]): void
  remove(): void
}

export type LeafletTileLayer = {
  addTo(map: LeafletMap): void
}

export type LeafletLib = {
  map(container: HTMLElement, options: object): LeafletMap
  tileLayer(url: string, options: { attribution: string; maxZoom: number }): LeafletTileLayer
  marker(latlng: [number, number]): LeafletMarker
}

declare global {
  interface Window {
    L?: LeafletLib
  }
}
