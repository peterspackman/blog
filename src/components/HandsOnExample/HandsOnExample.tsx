import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './HandsOnExample.module.css';

interface Step {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  script?: string;
  output?: string;
  notes?: string;
}

interface HandsOnExampleProps {
  title: string;
  description?: string;
  steps: Step[];
  className?: string;
}

const HandsOnExample: React.FC<HandsOnExampleProps> = ({
  title,
  description,
  steps,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleComplete = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepIndex)) {
      newCompleted.delete(stepIndex);
    } else {
      newCompleted.add(stepIndex);
    }
    setCompletedSteps(newCompleted);
  };

  const goToNextStep = () => {
    // Mark current step as completed
    const newCompleted = new Set(completedSteps);
    newCompleted.add(activeStep);
    setCompletedSteps(newCompleted);
    
    // Move to next step if not on last step
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const progressPercentage = (completedSteps.size / steps.length) * 100;

  return (
    <div className={clsx(styles.handsOnExample, className)}>
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>
            {title}
            <span className={clsx(styles.toggleIcon, { [styles.expanded]: isExpanded })}>
              ▼
            </span>
          </h3>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {completedSteps.size}/{steps.length} completed
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          {/* Timeline Tab Bar */}
          <div className={styles.timelineTabs}>
            <div className={styles.timelineContainer}>
              {steps.map((step, index) => {
                const isActive = activeStep === index;
                const isCompleted = completedSteps.has(index);
                const isAccessible = index === 0 || completedSteps.has(index - 1);
                
                return (
                  <React.Fragment key={step.id}>
                    <button
                      className={clsx(
                        styles.timelineTab,
                        { 
                          [styles.active]: isActive,
                          [styles.completed]: isCompleted,
                          [styles.disabled]: !isAccessible && !isCompleted
                        }
                      )}
                      onClick={() => isAccessible && setActiveStep(index)}
                      disabled={!isAccessible && !isCompleted}
                    >
                      <div className={styles.stepCircle}>
                        {isCompleted ? '✓' : index + 1}
                      </div>
                      <span className={styles.stepLabel}>{step.title}</span>
                    </button>
                    {index < steps.length - 1 && (
                      <div 
                        className={clsx(
                          styles.connectionLine,
                          { [styles.completed]: isCompleted }
                        )}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className={styles.stepContent}>
            {steps[activeStep] && (
              <div className={styles.stepPanel}>
                <div className={styles.stepHeader}>
                  <h4 className={styles.stepTitle}>
                    Step {activeStep + 1}: {steps[activeStep].title}
                  </h4>
                  {steps[activeStep].description && (
                    <p className={styles.stepDescription}>
                      {steps[activeStep].description}
                    </p>
                  )}
                </div>

                <div className={styles.stepSections}>
                  {steps[activeStep].instructions && (
                    <div className={styles.section}>
                      <div className="alert alert--secondary">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Instructions</h4>
                        <div dangerouslySetInnerHTML={{ __html: steps[activeStep].instructions }} />
                      </div>
                    </div>
                  )}

                  {steps[activeStep].script && (
                    <div className={styles.section}>
                      <div className="alert alert--warning">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Commands</h4>
                        <pre style={{ marginBottom: 0 }}><code>{steps[activeStep].script}</code></pre>
                      </div>
                    </div>
                  )}

                  {steps[activeStep].output && (
                    <div className={styles.section}>
                      <div className="alert alert--success">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Expected Output</h4>
                        <pre style={{ marginBottom: 0 }}><code>{steps[activeStep].output}</code></pre>
                      </div>
                    </div>
                  )}

                  {steps[activeStep].notes && (
                    <div className={styles.section}>
                      <div className="alert alert--info">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Notes</h4>
                        <div dangerouslySetInnerHTML={{ __html: steps[activeStep].notes }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Step Navigation */}
                <div className={styles.stepNavigation}>
                  <button
                    className={clsx(styles.navButton, styles.prevButton)}
                    onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                    disabled={activeStep === 0}
                  >
                    ← Previous
                  </button>

                  <button
                    className={clsx(styles.navButton, styles.nextButton)}
                    onClick={goToNextStep}
                  >
                    {activeStep === steps.length - 1 ? 'Complete Tutorial' : 'Next →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HandsOnExample;