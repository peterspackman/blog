import React, { useState, ReactElement, Children, isValidElement } from 'react';
import clsx from 'clsx';
import styles from './HandsOnExample.module.css';

interface TutorialProps {
  title: string;
  description?: string;
  children: ReactElement | ReactElement[];
  className?: string;
}

interface ParsedStep {
  id: string;
  title: string;
  instructions?: ReactElement;
  commands?: ReactElement;
  output?: ReactElement;
  notes?: ReactElement;
}

const Tutorial: React.FC<TutorialProps> = ({
  title,
  description,
  children,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  
  // Generate a unique key for this tutorial based on title
  const storageKey = `tutorial-progress-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  
  // Load progress from localStorage (client-side only)
  const loadProgress = (): Set<number> => {
    if (typeof window === 'undefined') {
      return new Set(); // Return empty set during SSR
    }
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const stepNumbers = JSON.parse(saved);
        return new Set(stepNumbers);
      }
    } catch (error) {
      console.warn('Failed to load tutorial progress:', error);
    }
    return new Set();
  };
  
  // Save progress to localStorage (client-side only)
  const saveProgress = (completedSteps: Set<number>) => {
    if (typeof window === 'undefined') {
      return; // Skip during SSR
    }
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(completedSteps)));
    } catch (error) {
      console.warn('Failed to save tutorial progress:', error);
    }
  };
  
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  // Load progress after component mounts (client-side only)
  React.useEffect(() => {
    setCompletedSteps(loadProgress());
  }, [storageKey]);
  
  // Save to localStorage whenever completedSteps changes
  React.useEffect(() => {
    saveProgress(completedSteps);
  }, [completedSteps, storageKey]);

  // Parse children to extract step information
  const steps: ParsedStep[] = Children.map(children, (child) => {
    if (!isValidElement(child)) return null;
    
    const stepId = child.props.id || Math.random().toString();
    const stepTitle = child.props.title || 'Untitled Step';
    
    const step: ParsedStep = {
      id: stepId,
      title: stepTitle
    };
    
    // Extract sections from children by checking the component type
    Children.forEach(child.props.children, (section) => {
      if (!isValidElement(section)) return;
      
      // Use data attributes to identify section types (minification-safe)
      const sectionType = section.props?.['data-section-type'];
      
      switch (sectionType) {
        case 'instructions':
          step.instructions = section;
          break;
        case 'commands':
          step.commands = section;
          break;
        case 'output':
          step.output = section;
          break;
        case 'notes':
          step.notes = section;
          break;
        default:
          // Fallback to component name matching for development
          const componentName = section.type?.displayName || section.type?.name;
          switch (componentName) {
            case 'Instructions':
              step.instructions = section;
              break;
            case 'Commands':
              step.commands = section;
              break;
            case 'Output':
              step.output = section;
              break;
            case 'Notes':
              step.notes = section;
              break;
          }
      }
    });
    
    return step;
  }).filter(Boolean) as ParsedStep[];

  // Debug: log the parsed steps in development only
  if (process.env.NODE_ENV === 'development') {
    console.log('Parsed steps:', steps);
  }

  const goToNextStep = () => {
    // Mark current step as completed
    const newCompleted = new Set(completedSteps);
    newCompleted.add(activeStep);
    setCompletedSteps(newCompleted);
    
    // Move to next step if not on last step
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      // If completing the last step (tutorial complete), auto-collapse
      setIsExpanded(false);
    }
  };

  const resetProgress = () => {
    setCompletedSteps(new Set());
    setActiveStep(0);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('Failed to clear tutorial progress:', error);
      }
    }
  };

  const progressPercentage = (completedSteps.size / steps.length) * 100;
  const isCompleted = completedSteps.size === steps.length;

  return (
    <div className={clsx(styles.handsOnExample, { [styles.completed]: isCompleted }, className)}>
      <div className={clsx(styles.header, { [styles.completedHeader]: isCompleted })}>
        <div className={styles.titleSection} onClick={() => setIsExpanded(!isExpanded)}>
          <h3 className={styles.title}>
            {title}
            {isCompleted && <span className={styles.completedBadge}>✓</span>}
            <span className={clsx(styles.toggleIcon, { [styles.expanded]: isExpanded })}>
              ▼
            </span>
          </h3>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={clsx(styles.progressFill, { [styles.completedFill]: isCompleted })} 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {completedSteps.size}/{steps.length} completed
          </span>
          <button 
            className={styles.resetButton}
            onClick={(e) => {
              e.stopPropagation();
              resetProgress();
            }}
            title="Reset progress"
          >
            ↻
          </button>
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
                </div>

                <div className={styles.stepSections}>
                  {steps[activeStep].instructions && (
                    <div className={styles.section}>
                      <div className="alert alert--secondary">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Instructions</h4>
                        {steps[activeStep].instructions.props.children}
                      </div>
                    </div>
                  )}

                  {steps[activeStep].commands && (
                    <div className={styles.section}>
                      <div className="alert alert--warning">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Commands</h4>
                        {steps[activeStep].commands.props.children}
                      </div>
                    </div>
                  )}

                  {steps[activeStep].output && (
                    <div className={styles.section}>
                      <div className="alert alert--success">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Expected Output</h4>
                        {steps[activeStep].output.props.children}
                      </div>
                    </div>
                  )}

                  {steps[activeStep].notes && (
                    <div className={styles.section}>
                      <div className="alert alert--info">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.9rem', fontWeight: '700', margin: '0 0 0.75rem 0' }}>Notes</h4>
                        {steps[activeStep].notes.props.children}
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

export default Tutorial;