import React, { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';

const CrystalViewer = () => {
    const viewerRef = useRef(null);
    const [stage, setStage] = useState(null);
    const [currentStructure, setCurrentStructure] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [structureName, setStructureName] = useState('');
    const [showUnitCell, setShowUnitCell] = useState(false);

    // Predefined structures with descriptions
    const predefinedStructures = [
        {
            id: 'calcite.pdb',
            name: 'Calcite (CaCO₃)',
            description: 'Calcium carbonate crystal structure'
        },
        {
            id: 'diamond.pdb',
            name: 'Diamond',
            description: 'Carbon atoms arranged in diamond lattice'
        },
        {
            id: 'graphite.pdb',
            name: 'Graphite',
            description: 'Layered carbon structure'
        },
        {
            id: 'BENZEN01.pdb',
            name: 'Benzene',
            description: 'Crystalline structure of benzene'
        },
        {
            id: 'NaCl.pdb',
            name: 'Salt (NaCl)',
            description: 'Rock salt crystal structure'
        }
    ];

    // Initialize NGL Viewer
    useEffect(() => {
        if (!viewerRef.current) return;

        try {
            // Create NGL Stage object
            const stageObj = new NGL.Stage(viewerRef.current, {
                backgroundColor: 'white',
                quality: 'medium',
                antialias: true,
            });

            // Handle window resizing
            const handleResize = () => {
                stageObj.handleResize();
            };

            window.addEventListener('resize', handleResize);
            setStage(stageObj);

            // Cleanup function
            return () => {
                window.removeEventListener('resize', handleResize);
                if (stageObj) stageObj.dispose();
            };
        } catch (error) {
            console.error('Error initializing NGL Stage:', error);
            setError('Failed to initialize viewer. Please refresh the page.');
        }
    }, []);

    // Toggle unit cell visibility
    const toggleUnitCell = () => {
        setShowUnitCell(!showUnitCell);

        if (currentStructure) {
            // Remove any existing unit cell representations
            currentStructure.removeRepresentation(rep => rep.name.includes('unitcell'));

            // Add unit cell if toggled on
            if (!showUnitCell) { // Using !showUnitCell because state hasn't updated yet

                // Add unit cell boundaries
                currentStructure.addRepresentation('unitcell', {
                    name: 'unitcell_box',
                    color: 'grey',
                    linewidth: 10,
                    opacity: 1.0
                });
            }
        }
    };

    // Load structure from local path
    const loadStructure = async (filename) => {
        if (!stage) return;

        setIsLoading(true);
        setError('');

        // Clear previous structure if any
        if (currentStructure) {
            stage.removeComponent(currentStructure);
            setCurrentStructure(null);
        }

        try {
            // Build the path to the local PDB file
            const url = `/pdb/${filename}`;

            // Load the structure
            const structure = await stage.loadFile(url, {
                defaultRepresentation: false
            });

            setCurrentStructure(structure);

            // Add basic representations
            structure.addRepresentation('cartoon', { color: 'chainname' });
            structure.addRepresentation('ball+stick', {
                colorScheme: 'element',
                multipleBond: true
            });

            // Add unit cell if the toggle is on
            if (showUnitCell) {
                // Add unit cell boundaries
                structure.addRepresentation('unitcell', {
                    name: 'unitcell_box',
                    color: 'grey',
                    linewidth: 10,
                    opacity: 1.0
                });
            }

            // Auto center and zoom to fit the structure
            stage.autoView();
            setStructureName(filename);
            setIsLoading(false);
        } catch (err) {
            console.error('Structure loading error:', err);
            setError(`Failed to load structure: ${err.message || 'Unknown error'}`);
            setIsLoading(false);
        }
    };

    // Load one of the predefined structures
    const loadPredefinedStructure = (filename) => {
        loadStructure(filename);
    };

    // Change the representation style
    const changeRepresentation = (repType) => {
        if (!currentStructure) return;

        // Clear current representations
        currentStructure.removeAllRepresentations();

        // Add the selected representation
        switch (repType) {
            case 'cartoon':
                currentStructure.addRepresentation('cartoon', { color: 'chainname' });
                break;
            case 'ball+stick':
                currentStructure.addRepresentation('ball+stick', {
                    colorScheme: 'element',
                    multipleBond: true
                });
                break;
            case 'spacefill':
                currentStructure.addRepresentation('spacefill', { colorScheme: 'element' });
                break;
            case 'surface':
                currentStructure.addRepresentation('surface', {
                    colorScheme: 'resname',
                    opacity: 0.8
                });
                break;
            case 'ribbon':
                currentStructure.addRepresentation('ribbon', { color: 'chainname' });
                break;
            case 'licorice':
                currentStructure.addRepresentation('licorice', { colorScheme: 'element' });
                break;
            default:
                // Default combination for crystal structures
                currentStructure.addRepresentation('ball+stick', {
                    colorScheme: 'element',
                    multipleBond: true
                });
        }
    };

    // Take a screenshot
    const takeScreenshot = () => {
        if (!stage) return;

        // Get the image as a blob URL
        const blobUrl = stage.makeImage({
            factor: 2,
            antialias: true,
            trim: false,
            transparent: false
        });

        // Create and click a download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `structure-${structureName.replace('.pdb', '')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="crystal-viewer-container">
            {/* Viewer */}
            <div
                className="viewer-wrapper"
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '400px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: '#f5f5f5'
                }}
            >
                {/* NGL Viewer container */}
                <div
                    ref={viewerRef}
                    style={{
                        width: '100%',
                        height: '100%'
                    }}
                />

                {/* Overlay for initial state */}
                {!currentStructure && !isLoading && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            pointerEvents: 'none'
                        }}
                    >
                        <p style={{ fontSize: '16px', color: '#666' }}>
                            No structure loaded
                        </p>
                        <p style={{ fontSize: '14px', color: '#888' }}>
                            Select a crystal structure below
                        </p>
                    </div>
                )}

                {/* Loading indicator */}
                {isLoading && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.7)'
                        }}
                    >
                        <p>Loading structure...</p>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div
                    style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#fed7d7',
                        color: '#9b2c2c',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}
                >
                    {error}
                </div>
            )}

            {/* Controls section */}
            <div style={{ marginTop: '16px' }}>
                {/* Predefined structures */}
                <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Crystal Structures</h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '8px'
                    }}>
                        {predefinedStructures.map(structure => (
                            <button
                                key={structure.id}
                                onClick={() => loadPredefinedStructure(structure.id)}
                                title={structure.description}
                                style={{
                                    padding: '8px',
                                    backgroundColor: structure.id === structureName ? '#ebf8ff' : '#f7fafc',
                                    border: '1px solid #cbd5e0',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    textAlign: 'left'
                                }}
                            >
                                {structure.name}
                                <div style={{ fontSize: '12px', color: '#718096' }}>{structure.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Display options - only show when structure is loaded */}
                {currentStructure && (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Display Style</h3>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}>
                                <button
                                    onClick={() => changeRepresentation('ball+stick')}
                                    style={{
                                        padding: '6px 12px',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Ball & Stick
                                </button>
                                <button
                                    onClick={() => changeRepresentation('spacefill')}
                                    style={{
                                        padding: '6px 12px',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Spacefill
                                </button>
                                <button
                                    onClick={() => changeRepresentation('licorice')}
                                    style={{
                                        padding: '6px 12px',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Licorice
                                </button>
                                <button
                                    onClick={() => changeRepresentation('surface')}
                                    style={{
                                        padding: '6px 12px',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Surface
                                </button>
                            </div>


                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <label
                                    htmlFor="unitcell-toggle"
                                    style={{
                                        fontSize: '14px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Show Unit Cell
                                </label>
                                <input
                                    id="unitcell-toggle"
                                    type="checkbox"
                                    checked={showUnitCell}
                                    onChange={toggleUnitCell}
                                    style={{
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CrystalViewer;
