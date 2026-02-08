'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { FileUpload, type FileAttachment } from '@/components/ui/file-upload';
import {
  newTicketSchema,
  defaultTicketValues,
  ticketTypeLabels,
  ticketSeverityLabels,
  ticketSeverityColors,
  type NewTicketInput,
  type TicketType,
  type TicketSeverity,
} from '@/lib/validations/ticket';
import {
  useCreateTicketMutation,
  useDuplicateCheck,
  useApplications,
  useFileUpload,
  useAutoSave,
  loadDraft,
  clearDraft,
  saveDraft,
} from '@/hooks/use-new-ticket-form';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  RotateCcw,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

// Form steps configuration
const FORM_STEPS = [
  { id: 'basics', title: 'Basic Info', description: 'Title, type, and severity' },
  { id: 'details', title: 'Details', description: 'Description and reproduction steps' },
  { id: 'attachments', title: 'Attachments', description: 'Files and screenshots' },
  { id: 'review', title: 'Review', description: 'Review and submit' },
] as const;

type FormStep = (typeof FORM_STEPS)[number]['id'];

// Step indicator component
function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  completedSteps,
}: {
  steps: typeof FORM_STEPS;
  currentStep: FormStep;
  onStepClick: (step: FormStep) => void;
  completedSteps: Set<FormStep>;
}) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <li
              key={step.id}
              className={cn('relative flex-1', index !== steps.length - 1 && 'pr-8 sm:pr-20')}
            >
              {/* Connector line */}
              {index !== steps.length - 1 && (
                <div
                  className="absolute top-4 left-0 w-full h-0.5 -translate-y-1/2"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'h-full transition-colors',
                      isPast || isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                </div>
              )}

              {/* Step button */}
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className={cn(
                  'relative flex flex-col items-center group',
                  (isPast || isCompleted) && 'cursor-pointer'
                )}
                disabled={!isPast && !isCompleted && !isCurrent}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    isCurrent && 'bg-primary text-primary-foreground',
                    isCompleted && !isCurrent && 'bg-primary text-primary-foreground',
                    isPast && !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                    !isPast && !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium hidden sm:block',
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Duplicate title warning component
function DuplicateWarning({
  title,
  isChecking,
  duplicateData,
}: {
  title: string;
  isChecking: boolean;
  duplicateData?: {
    isDuplicate: boolean;
    similarTickets?: Array<{ id: string; title: string; similarity: number }>;
  };
}) {
  if (!title || title.length < 5) return null;
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking for duplicates...
      </div>
    );
  }

  if (duplicateData?.isDuplicate && duplicateData.similarTickets?.length) {
    return (
      <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Similar tickets found
            </p>
            <ul className="mt-1 space-y-1">
              {duplicateData.similarTickets.slice(0, 3).map(ticket => (
                <li key={ticket.id} className="text-yellow-700 dark:text-yellow-300">
                  <a
                    href={`/tickets/${ticket.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    {ticket.title}
                  </a>
                  <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                    ({Math.round(ticket.similarity * 100)}% match)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Reproduction steps editor
function ReproductionStepsEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (steps: string[]) => void;
  disabled?: boolean;
}) {
  const addStep = () => {
    onChange([...value, '']);
  };

  const removeStep = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, newValue: string) => {
    const newSteps = [...value];
    newSteps[index] = newValue;
    onChange(newSteps);
  };

  return (
    <div className="space-y-3">
      {value.map((step, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="flex-shrink-0 h-9 w-6 flex items-center justify-center text-sm text-muted-foreground font-medium">
            {index + 1}.
          </span>
          <Input
            value={step}
            onChange={e => updateStep(index, e.target.value)}
            placeholder={`Step ${index + 1}`}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeStep(index)}
            disabled={disabled}
            className="flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addStep}
        disabled={disabled}
        className="ml-8"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Step
      </Button>
    </div>
  );
}

// Main form component
export function AdvancedNewTicketForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<FormStep>('basics');
  const [completedSteps, setCompletedSteps] = useState<Set<FormStep>>(new Set());
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [hasDraftChecked, setHasDraftChecked] = useState(false);

  // Load saved draft
  const savedDraft = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return loadDraft();
  }, []);

  // Check for draft on mount
  useEffect(() => {
    if (!hasDraftChecked && savedDraft) {
      setShowDraftDialog(true);
    }
    setHasDraftChecked(true);
  }, [savedDraft, hasDraftChecked]);

  // Initialize form with TanStack Form
  const form = useForm({
    defaultValues: defaultTicketValues,
    onSubmit: async ({ value }) => {
      createTicket.mutate(value);
    },
    validatorAdapter: zodValidator(),
  });

  // Load draft values into form
  const loadDraftValues = useCallback(() => {
    if (savedDraft) {
      const { savedAt, ...draftValues } = savedDraft;
      Object.entries(draftValues).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setFieldValue(key as keyof NewTicketInput, value as never);
        }
      });
      toast({
        title: 'Draft restored',
        description: `Loaded draft from ${new Date(savedAt || '').toLocaleString()}`,
      });
    }
    setShowDraftDialog(false);
  }, [savedDraft, form, toast]);

  // Discard draft
  const discardDraft = useCallback(() => {
    clearDraft();
    setShowDraftDialog(false);
  }, []);

  // Mutations and queries
  const createTicket = useCreateTicketMutation();
  const { data: applications, isLoading: applicationsLoading } = useApplications();
  const fileUpload = useFileUpload();

  // Get current form values for validation and display
  const formValues = form.useStore(state => state.values);

  // Duplicate check for title (async validation)
  const { data: duplicateData, isLoading: duplicateChecking } = useDuplicateCheck(
    formValues.title,
    formValues.title.length >= 5
  );

  // Auto-save functionality
  useAutoSave(
    useCallback(() => formValues, [formValues]),
    30000 // 30 seconds
  );

  // Field dependency: auto-set severity based on type
  useEffect(() => {
    // If type is 'bug' and severity hasn't been manually changed, suggest high
    // This is a soft suggestion, not enforced
  }, [formValues.type]);

  // Step validation
  const validateStep = useCallback(
    (step: FormStep): boolean => {
      switch (step) {
        case 'basics':
          return (
            formValues.title.length > 0 &&
            formValues.title.length <= 500 &&
            formValues.type !== undefined &&
            formValues.severity !== undefined &&
            formValues.applicationId.length > 0
          );
        case 'details':
          return formValues.description.length > 0;
        case 'attachments':
          return true; // Optional step
        case 'review':
          return validateStep('basics') && validateStep('details');
        default:
          return false;
      }
    },
    [formValues]
  );

  // Navigate between steps
  const goToStep = useCallback(
    (step: FormStep) => {
      // Mark current step as completed if valid
      if (validateStep(currentStep)) {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
      }
      setCurrentStep(step);
    },
    [currentStep, validateStep]
  );

  const nextStep = useCallback(() => {
    const currentIndex = FORM_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < FORM_STEPS.length - 1) {
      goToStep(FORM_STEPS[currentIndex + 1].id);
    }
  }, [currentStep, goToStep]);

  const prevStep = useCallback(() => {
    const currentIndex = FORM_STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      goToStep(FORM_STEPS[currentIndex - 1].id);
    }
  }, [currentStep, goToStep]);

  // Manual save draft
  const handleSaveDraft = useCallback(() => {
    saveDraft(formValues);
    toast({
      title: 'Draft saved',
      description: 'Your progress has been saved.',
    });
  }, [formValues, toast]);

  // Reset form
  const handleReset = useCallback(() => {
    form.reset();
    clearDraft();
    setCurrentStep('basics');
    setCompletedSteps(new Set());
    toast({
      title: 'Form reset',
      description: 'All fields have been cleared.',
    });
  }, [form, toast]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      return fileUpload.mutateAsync(file);
    },
    [fileUpload]
  );

  const currentStepIndex = FORM_STEPS.findIndex(s => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === FORM_STEPS.length - 1;
  const canProceed = validateStep(currentStep);

  return (
    <>
      {/* Draft restoration dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore draft?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved draft from{' '}
              {savedDraft?.savedAt ? new Date(savedDraft.savedAt).toLocaleString() : 'earlier'}.
              Would you like to restore it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardDraft}>Start fresh</AlertDialogCancel>
            <AlertDialogAction onClick={loadDraftValues}>Restore draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          if (isLastStep) {
            form.handleSubmit();
          } else {
            nextStep();
          }
        }}
        className="space-y-6"
      >
        {/* Step indicator */}
        <StepIndicator
          steps={FORM_STEPS}
          currentStep={currentStep}
          onStepClick={goToStep}
          completedSteps={completedSteps}
        />

        {/* Step content */}
        <Card>
          <CardHeader>
            <CardTitle>{FORM_STEPS[currentStepIndex].title}</CardTitle>
            <CardDescription>{FORM_STEPS[currentStepIndex].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Info */}
            {currentStep === 'basics' && (
              <>
                {/* Title field */}
                <form.Field
                  name="title"
                  validators={{
                    onChange: newTicketSchema.shape.title,
                    onChangeAsync: async ({ value }) => {
                      // Async validation for duplicates (returns warning, not error)
                      if (value.length >= 5 && duplicateData?.isDuplicate) {
                        return 'Similar tickets exist. Please check before submitting.';
                      }
                      return undefined;
                    },
                    onChangeAsyncDebounceMs: 500,
                  }}
                >
                  {field => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={field.name}
                        placeholder="Brief description of the issue"
                        value={field.state.value}
                        onChange={e => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        maxLength={500}
                      />
                      <div className="flex justify-between">
                        <div>
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                              {field.state.meta.errors.join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {field.state.value.length}/500
                        </span>
                      </div>
                      <DuplicateWarning
                        title={field.state.value}
                        isChecking={duplicateChecking}
                        duplicateData={duplicateData}
                      />
                    </div>
                  )}
                </form.Field>

                {/* Type field */}
                <form.Field name="type">
                  {field => (
                    <div className="space-y-2">
                      <Label>
                        Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={value => {
                          field.handleChange(value as TicketType);
                          // Auto-suggest severity based on type
                          if (value === 'bug' && formValues.severity === 'medium') {
                            form.setFieldValue('severity', 'high');
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ticketTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                {/* Severity field */}
                <form.Field name="severity">
                  {field => (
                    <div className="space-y-2">
                      <Label>
                        Severity <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={value => field.handleChange(value as TicketSeverity)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ticketSeverityLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'px-2 py-0.5 text-xs',
                                    ticketSeverityColors[value as TicketSeverity]
                                  )}
                                >
                                  {label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                {/* Application field */}
                <form.Field
                  name="applicationId"
                  validators={{
                    onChange: newTicketSchema.shape.applicationId,
                  }}
                >
                  {field => (
                    <div className="space-y-2">
                      <Label>
                        Application <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        disabled={applicationsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select application" />
                        </SelectTrigger>
                        <SelectContent>
                          {applications?.data?.map(app => (
                            <SelectItem key={app.id} value={app.id}>
                              {app.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
              </>
            )}

            {/* Step 2: Details */}
            {currentStep === 'details' && (
              <>
                {/* Description field */}
                <form.Field
                  name="description"
                  validators={{
                    onChange: newTicketSchema.shape.description,
                  }}
                >
                  {field => (
                    <div className="space-y-2">
                      <Label>
                        Description <span className="text-destructive">*</span>
                      </Label>
                      <RichTextEditor
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        placeholder="Describe the issue in detail..."
                        error={field.state.meta.errors.length > 0}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                {/* Reproduction steps */}
                <form.Field name="reproductionSteps">
                  {field => (
                    <div className="space-y-2">
                      <Label>Steps to Reproduce (optional)</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        List the steps to reproduce the issue
                      </p>
                      <ReproductionStepsEditor
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    </div>
                  )}
                </form.Field>
              </>
            )}

            {/* Step 3: Attachments */}
            {currentStep === 'attachments' && (
              <form.Field name="attachments">
                {field => (
                  <div className="space-y-2">
                    <Label>Attachments (optional)</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Upload screenshots, videos, or other relevant files
                    </p>
                    <FileUpload
                      value={field.state.value as FileAttachment[]}
                      onChange={files => field.handleChange(files as never)}
                      onUpload={handleFileUpload}
                      maxFiles={5}
                      maxSize={10 * 1024 * 1024} // 10MB
                    />
                  </div>
                )}
              </form.Field>
            )}

            {/* Step 4: Review */}
            {currentStep === 'review' && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{formValues.title}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p className="font-medium">{ticketTypeLabels[formValues.type]}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Severity</Label>
                      <Badge className={cn('mt-1', ticketSeverityColors[formValues.severity])}>
                        {ticketSeverityLabels[formValues.severity]}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Application</Label>
                      <p className="font-medium">
                        {applications?.data?.find(a => a.id === formValues.applicationId)?.name ||
                          'Not selected'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <div
                      className="mt-1 prose prose-sm dark:prose-invert max-w-none p-3 bg-muted rounded-md"
                      dangerouslySetInnerHTML={{ __html: formValues.description }}
                    />
                  </div>

                  {formValues.reproductionSteps.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Steps to Reproduce</Label>
                      <ol className="mt-1 list-decimal list-inside space-y-1">
                        {formValues.reproductionSteps
                          .filter(step => step.trim())
                          .map((step, index) => (
                            <li key={index} className="text-sm">
                              {step}
                            </li>
                          ))}
                      </ol>
                    </div>
                  )}

                  {formValues.attachments.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Attachments</Label>
                      <p className="text-sm">{formValues.attachments.length} file(s) attached</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={createTicket.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={createTicket.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          <div className="flex gap-2">
            {!isFirstStep && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={createTicket.isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <Button type="submit" disabled={!canProceed || createTicket.isPending}>
              {createTicket.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : isLastStep ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Ticket
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
