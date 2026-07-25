function applyBranding() {
  const brand = CONFIG.brand;

  $("brandName").textContent = brand.name;
  $("editionBadge").textContent = brand.edition;

  $("editionBadge").classList.toggle(
    "hidden",
    !brand.showEditionBadge || !brand.edition
  );

  $("pageTitle").textContent = brand.pageTitle;
  $("cageInputHint").textContent = brand.inputHint;
  $("cageInput").placeholder = brand.inputPlaceholder;

  document.title = brand.edition
    ? `${brand.name} ${brand.edition}`
    : brand.name;
}