import { useState, useCallback, useRef } from 'react';
import { GCMCParticleData, createGCMCParticleArrays, initializeGCMCPositions, calculateTotalEnergy, InitLayout } from './GCMCParticleData';
import { MCEngine, MCTrialResult, MCEngineConfig } from './MCEngine';
import { ExternalPotential } from './ExternalPotentials';
import { GCMCAnalyticsEngine, GCMCSnapshot } from './GCMCAnalytics';
import { LennardJonesPotential, CoulombPotential, PotentialManager } from '../md/Potentials';

interface UseGCMCSimulationProps {
    initLayout: InitLayout;
    numTypes: number;
    temperature: number;
    chemicalPotentials: number[];
    maxDisplacement: number;
    boxWidth: number;
    boxHeight: number;
    moveWeights: { displacement: number; insertion: number; deletion: number };
    epsilonMatrix: number[][];
    sigmaMatrix: number[][];
    masses: number[];
    charges: number[];
    chargeScale: number;
    cutoffRadius: number;
    externalPotential: ExternalPotential | null;
    analytics: GCMCAnalyticsEngine | null;
    typeRatio: number;
}

export function useGCMCSimulation({
    initLayout,
    numTypes,
    temperature,
    chemicalPotentials,
    maxDisplacement,
    boxWidth,
    boxHeight,
    moveWeights,
    epsilonMatrix,
    sigmaMatrix,
    masses,
    charges,
    chargeScale,
    cutoffRadius,
    externalPotential,
    analytics,
    typeRatio,
}: UseGCMCSimulationProps) {
    const [particleData, setParticleData] = useState<GCMCParticleData | null>(null);
    const particleDataRef = useRef<GCMCParticleData | null>(null);
    const mcEngineRef = useRef<MCEngine | null>(null);
    const potentialRef = useRef<PotentialManager | null>(null);
    const ljRef = useRef<LennardJonesPotential | null>(null);
    const coulombRef = useRef<CoulombPotential | null>(null);
    const stepCountRef = useRef(0);
    const [displayStepCount, setDisplayStepCount] = useState(0);
    const lastTrialRef = useRef<MCTrialResult | null>(null);
    const totalEnergyRef = useRef(0);

    const initializeParticles = useCallback(() => {
        const data = createGCMCParticleArrays(0, numTypes, 256);

        const sigma = sigmaMatrix[0]?.[0] ?? 3.4;
        initializeGCMCPositions(data, initLayout, boxWidth, boxHeight, masses, sigma, typeRatio);

        // Create potentials
        const lj = new LennardJonesPotential(epsilonMatrix, sigmaMatrix, 1.0, 1.0, cutoffRadius);
        ljRef.current = lj;
        const manager = new PotentialManager();
        manager.addPotential(lj, 1.0);
        if (chargeScale > 0 && charges.some(q => q !== 0)) {
            const coulomb = new CoulombPotential(charges, chargeScale, 14.3996, cutoffRadius);
            coulombRef.current = coulomb;
            manager.addPotential(coulomb, 1.0);
        } else {
            coulombRef.current = null;
        }
        potentialRef.current = manager;

        // Calculate initial total energy
        const potentialAdapter = { calculate: (r: number, t1: number, t2: number) => manager.calculateTotal(r, t1, t2) };
        totalEnergyRef.current = calculateTotalEnergy(data, potentialAdapter, boxWidth, boxHeight);

        // Create MC engine with current params
        const config: MCEngineConfig = {
            temperature,
            chemicalPotentials,
            maxDisplacement,
            boxWidth,
            boxHeight,
            moveWeights,
            masses,
            cutoffRadius,
        };
        const engine = new MCEngine(config, potentialAdapter, externalPotential);
        mcEngineRef.current = engine;

        stepCountRef.current = 0;
        setDisplayStepCount(0);
        lastTrialRef.current = null;

        if (analytics) {
            analytics.reset();
        }

        particleDataRef.current = data;
        setParticleData({ ...data });
    // Only re-init when structural parameters change (particle count, box size, masses)
    // Temperature, chemicalPotentials, potentials update live via mcStep's updateConfig
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initLayout, numTypes, boxWidth, boxHeight, typeRatio, chargeScale]);

    // Track last-used potential params to detect changes requiring energy recalc
    const lastEpsilonRef = useRef(epsilonMatrix);
    const lastSigmaRef = useRef(sigmaMatrix);
    const lastCutoffRef = useRef(cutoffRadius);

    const mcStep = useCallback((): MCTrialResult | null => {
        const data = particleDataRef.current;
        const engine = mcEngineRef.current;
        if (!data || !engine) return null;

        // Update engine config with current parameters
        engine.updateConfig({
            temperature,
            chemicalPotentials,
            maxDisplacement,
            boxWidth,
            boxHeight,
            moveWeights,
            masses,
            cutoffRadius,
        });

        if (ljRef.current) {
            ljRef.current.updateParameters(epsilonMatrix, sigmaMatrix);
            ljRef.current.setCutoff(cutoffRadius);
        }
        if (coulombRef.current) {
            coulombRef.current.updateCharges(charges, chargeScale);
            coulombRef.current.setCutoff(cutoffRadius);
        }

        // Recalculate total energy when potential parameters change
        if (epsilonMatrix !== lastEpsilonRef.current ||
            sigmaMatrix !== lastSigmaRef.current ||
            cutoffRadius !== lastCutoffRef.current) {
            lastEpsilonRef.current = epsilonMatrix;
            lastSigmaRef.current = sigmaMatrix;
            lastCutoffRef.current = cutoffRadius;
            if (potentialRef.current) {
                const adapter = { calculate: (r: number, t1: number, t2: number) => potentialRef.current!.calculateTotal(r, t1, t2) };
                totalEnergyRef.current = calculateTotalEnergy(data, adapter, boxWidth, boxHeight);
            }
        }

        engine.updateExternalPotential(externalPotential);

        const result = engine.step(data);
        lastTrialRef.current = result;

        // Track total energy incrementally
        if (result.accepted) {
            totalEnergyRef.current += result.energyChange;
        }

        stepCountRef.current++;

        return result;
    }, [temperature, chemicalPotentials, maxDisplacement, boxWidth, boxHeight,
        moveWeights, epsilonMatrix, sigmaMatrix, masses, cutoffRadius, externalPotential]);

    const recordAnalytics = useCallback(() => {
        const data = particleDataRef.current;
        const engine = mcEngineRef.current;
        if (!data || !engine || !analytics) return;

        const rates = engine.getRecentAcceptanceRates();
        const V = boxWidth * boxHeight;

        const snapshot: GCMCSnapshot = {
            step: stepCountRef.current,
            particleCount: data.count,
            particleCountsByType: [...data.typeCounts],
            totalEnergy: totalEnergyRef.current,
            density: data.count / V,
            acceptanceRates: rates,
        };
        analytics.recordSnapshot(snapshot);

        // Update RDF periodically
        if (stepCountRef.current % 50 === 0) {
            analytics.calculateRDF(data, boxWidth, boxHeight);
            analytics.calculateDensityProfile(data, boxWidth, boxHeight);
        }
    }, [analytics, boxWidth, boxHeight]);

    const syncState = useCallback(() => {
        const data = particleDataRef.current;
        if (data) {
            setParticleData({ ...data });
        }
        setDisplayStepCount(stepCountRef.current);
    }, []);

    return {
        particleData,
        particleDataRef,
        initializeParticles,
        mcStep,
        recordAnalytics,
        syncState,
        stepCount: displayStepCount,
        lastTrialRef,
        mcEngineRef,
        totalEnergy: totalEnergyRef,
    };
}
