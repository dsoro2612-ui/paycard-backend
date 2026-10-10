// tiers.js — Seuils des paliers de carte, calculés côté serveur à partir du
// solde pour que le client ne puisse pas falsifier son propre palier.

const TIERS = [
  { key: 'rainbow', label: 'Infinie', name: 'Arc-en-ciel', min: 100_000_000 },
  { key: 'black', label: 'Signature', name: 'Noire', min: 20_000_000 },
  { key: 'red', label: 'Excellence', name: 'Rouge', min: 1_000_000 },
  { key: 'blue', label: 'Privilège', name: 'Bleue', min: 500_000 },
  { key: 'white', label: 'Essentielle', name: 'Blanche', min: 100_000 },
];

function getTier(balance) {
  const match = TIERS.find((t) => balance >= t.min);
  return match ? match.key : 'default';
}

module.exports = { TIERS, getTier };
