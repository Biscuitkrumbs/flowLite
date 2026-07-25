const CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbzA7up-uF8XeqWmVYfgYCOARqVeG1axNkD3D33OzOBApa4F9BUEgclzSEPtfe8bAnDC/exec",
  debug: true,

  brand: {
    name: "Flow",
    edition: "Lite",
    showEditionBadge: true,
    pageTitle: "Cage Flow",
    defaultPageTitle: "Cage Flow",
    dashboardPageTitle: "Instrument Panel",
    inputHint: "Scan or enter cage ID",
    inputPlaceholder: "Cage ID"
  },

  messages: {
    cageNotFound:
      "Cage not found. Scan the QR code attached to the cage to register it.",
    invalidCageCode:
      "This is not a recognised cage. Please scan the QR code attached to the cage."
  }
};
