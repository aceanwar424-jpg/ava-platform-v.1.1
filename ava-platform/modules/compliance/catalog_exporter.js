// OWNED_BY: generic. Compatibility entry; clinical catalog lives in the reviewed source module.
// No hardcoded ranges, demo source records, or fake download acknowledgements.
window.catalogExporter = Object.freeze({
  generateLisReadyCatalog() {
    throw Error(
      "Gunakan konfigurasi metode tenant disahkan; tidak ada katalog demo klinis.",
    );
  },
  render() {
    if (typeof window.renderReviewedCatalog !== "function")
      throw Error("Muat modul katalog sumber terlebih dahulu");
    return window.renderReviewedCatalog();
  },
});
