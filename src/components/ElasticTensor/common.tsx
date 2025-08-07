

function getPropertyTitle(property: string): string {
  const titles = {
    'youngs': "Young's Modulus",
    'linear_compressibility': 'Linear Compressibility',
    'shear': 'Shear Modulus',
    'poisson': "Poisson's Ratio"
  };
  return titles[property] || property;
}

function getPropertyUnit(property: string): string {
  const units = {
    'youngs': 'GPa',
    'linear_compressibility': 'TPa⁻¹',
    'shear': 'GPa',
    'poisson': ''
  };
  return units[property] || '';
}
