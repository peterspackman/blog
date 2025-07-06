import React, { ReactNode } from 'react';

interface StepProps {
  id: string;
  title: string;
  children: ReactNode;
}

interface InstructionsProps {
  children: ReactNode;
}

interface CommandsProps {
  children: ReactNode;
}

interface OutputProps {
  children: ReactNode;
}

interface NotesProps {
  children: ReactNode;
}

// Individual section components
export const Instructions: React.FC<InstructionsProps> = ({ children }) => (
  <div data-section-type="instructions">{children}</div>
);

export const Commands: React.FC<CommandsProps> = ({ children }) => (
  <div data-section-type="commands">{children}</div>
);

export const Output: React.FC<OutputProps> = ({ children }) => (
  <div data-section-type="output">{children}</div>
);

export const Notes: React.FC<NotesProps> = ({ children }) => (
  <div data-section-type="notes">{children}</div>
);

// Main Step component
const Step: React.FC<StepProps> = ({ id, title, children }) => {
  return (
    <div data-step-id={id} data-step-title={title}>
      {children}
    </div>
  );
};

export default Step;