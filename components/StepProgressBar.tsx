
import React from 'react';
import { AppStep, Round } from '../types';

interface Props {
  currentStep: AppStep;
  round?: Round;
}

export const StepProgressBar: React.FC<Props> = ({ currentStep, round }) => {
  const steps = [
    { id: AppStep.NORMAL_SELECTION, label: 'Gardes Cibles', color: 'bg-orange-500 shadow-orange-200', active: round?.step_normal_active ?? true },
    { id: AppStep.GOOD_BONUS_SELECTION, label: 'Bonnes Gardes', color: 'bg-blue-600 shadow-blue-200', active: round?.step_good_bonus_active ?? true },
    { id: AppStep.BAD_BONUS_SELECTION, label: 'Gardes Normales', color: 'bg-indigo-700 shadow-indigo-200', active: round?.step_bad_bonus_active ?? true },
    { id: AppStep.RECAP_ORDERING, label: 'Classement Final', color: 'bg-emerald-500 shadow-emerald-200', active: true },
  ].filter(s => s.active);

  return (
    <div className="flex items-center gap-2 md:gap-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all
              ${currentStep === step.id ? `${step.color} text-white shadow-xl scale-125` : 
                currentStep > step.id ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}
            `}>
              {currentStep > step.id ? '✓' : step.id}
            </div>
            <span className={`hidden md:block text-[10px] font-black uppercase tracking-tighter ${currentStep === step.id ? 'text-slate-800' : 'text-slate-400 opacity-60'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`h-0.5 w-6 md:w-10 rounded-full transition-colors duration-500 ${currentStep > step.id ? 'bg-green-500' : 'bg-slate-200'}`}></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
