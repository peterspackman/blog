import Layout from '@theme/Layout';
import SphericalHarmonicsViewer from '@site/src/components/SphericalHarmonicsViewer';

export default function SphericalHarmonicsPage() {
  return (
    <Layout
      title="Spherical Harmonics Visualization"
      description="Interactive visualization of spherical harmonics and atomic orbitals">
      <SphericalHarmonicsViewer />
    </Layout>
  );
}
