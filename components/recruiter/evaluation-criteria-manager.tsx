"use client"

import { useState } from "react"
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  X,
  Info,
  SlidersHorizontal,
  AlertCircle,
  Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EvaluationCriterion } from "@/lib/demo-data"

interface EvaluationCriteriaManagerProps {
  criteria: EvaluationCriterion[]
  onChange: (updatedCriteria: EvaluationCriterion[]) => void
  originalCriteria?: EvaluationCriterion[]
  disabled?: boolean
}

export function EvaluationCriteriaManager({
  criteria = [],
  onChange,
  originalCriteria = [],
  disabled = false,
}: EvaluationCriteriaManagerProps) {
  // Editing state: id of criterion currently being edited (or "new" for adding)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formAspects, setFormAspects] = useState<string[]>([])
  const [aspectInput, setAspectInput] = useState("")
  const [formImportance, setFormImportance] = useState<"high" | "medium" | "low">("high")
  const [formError, setFormError] = useState<string | null>(null)

  // Check if criteria have been customized compared to original AI-generated criteria
  const isModified =
    originalCriteria.length > 0 &&
    (criteria.length !== originalCriteria.length ||
      criteria.some(
        (c, idx) =>
          !originalCriteria[idx] ||
          c.title !== originalCriteria[idx].title ||
          c.description !== originalCriteria[idx].description ||
          c.importance !== originalCriteria[idx].importance ||
          c.keyAspects.join(",") !== originalCriteria[idx].keyAspects.join(",")
      ))

  const startEdit = (criterion: EvaluationCriterion) => {
    setEditingId(criterion.id)
    setFormTitle(criterion.title)
    setFormDesc(criterion.description)
    setFormAspects([...criterion.keyAspects])
    setAspectInput("")
    setFormImportance(criterion.importance || "high")
    setFormError(null)
  }

  const startAdd = () => {
    setEditingId("new")
    setFormTitle("")
    setFormDesc("")
    setFormAspects([])
    setAspectInput("")
    setFormImportance("high")
    setFormError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormError(null)
  }

  const handleAddAspect = () => {
    const trimmed = aspectInput.trim()
    if (!trimmed) return
    // Allow comma-separated pasting/typing
    const splitAspects = trimmed
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0 && !formAspects.includes(a))
    if (splitAspects.length > 0) {
      setFormAspects([...formAspects, ...splitAspects])
      setAspectInput("")
    }
  }

  const handleRemoveAspect = (aspectToRemove: string) => {
    setFormAspects(formAspects.filter((a) => a !== aspectToRemove))
  }

  const saveForm = () => {
    if (!formTitle.trim()) {
      setFormError("Criterion title is required.")
      return
    }
    if (!formDesc.trim()) {
      setFormError("Description of what will be evaluated is required.")
      return
    }

    // Auto-commit any leftover text in aspect input
    let finalAspects = [...formAspects]
    if (aspectInput.trim()) {
      const pending = aspectInput
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0 && !finalAspects.includes(a))
      finalAspects = [...finalAspects, ...pending]
    }

    if (finalAspects.length === 0) {
      finalAspects = [formTitle.trim()]
    }

    if (editingId === "new") {
      const newCriterion: EvaluationCriterion = {
        id: `criterion_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: formTitle.trim(),
        description: formDesc.trim(),
        keyAspects: finalAspects,
        importance: formImportance,
      }
      onChange([...criteria, newCriterion])
    } else {
      const updated = criteria.map((c) =>
        c.id === editingId
          ? {
              ...c,
              title: formTitle.trim(),
              description: formDesc.trim(),
              keyAspects: finalAspects,
              importance: formImportance,
            }
          : c
      )
      onChange(updated)
    }

    setEditingId(null)
    setFormError(null)
  }

  const handleDelete = (idToDelete: string) => {
    if (criteria.length <= 1) {
      alert("At least one evaluation criterion is required to evaluate candidates.")
      return
    }
    onChange(criteria.filter((c) => c.id !== idToDelete))
    if (editingId === idToDelete) {
      setEditingId(null)
    }
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...criteria]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    onChange(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index === criteria.length - 1) return
    const updated = [...criteria]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index] = temp
    onChange(updated)
  }

  const handleRestoreOriginal = () => {
    if (originalCriteria.length > 0) {
      onChange([...originalCriteria])
      setEditingId(null)
    }
  }

  const getImportanceBadge = (importance: "high" | "medium" | "low") => {
    switch (importance) {
      case "high":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400"
          >
            Importance: High
          </Badge>
        )
      case "medium":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
          >
            Importance: Medium
          </Badge>
        )
      case "low":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-medium bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400"
          >
            Importance: Low
          </Badge>
        )
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
            <SlidersHorizontal className="size-4 text-primary shrink-0" />
            <span>AI Interview Evaluation Criteria</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
          >
            <Sparkles className="size-2.5 mr-1 inline" /> AI Generated
          </Badge>
          {isModified && (
            <Badge
              variant="secondary"
              className="text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
            >
              Customized by Recruiter
            </Badge>
          )}
          {editingId && (
            <Badge
              variant="outline"
              className="text-[10px] font-normal animate-pulse border-primary/40 text-primary bg-primary/5"
            >
              Unsaved edits in progress
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isModified && originalCriteria.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestoreOriginal}
              disabled={disabled}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
              title="Discard custom modifications and restore original AI-generated criteria"
            >
              <RotateCcw className="size-3" />
              Restore AI Criteria
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startAdd}
            disabled={disabled || editingId !== null}
            className="h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Plus className="size-3.5" />
            Add Criterion
          </Button>
        </div>
      </div>

      {/* Short Explanatory Prompt */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        The AI has analysed your job description and identified the following areas to evaluate candidates during the
        interview. Review and customize these criteria before publishing.
      </p>

      {/* New Criterion Form (when adding) */}
      {editingId === "new" && (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3.5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Plus className="size-3.5" /> Add New Evaluation Criterion
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {formError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2.5 py-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <Label className="text-[11px] font-medium text-foreground">Criterion Title</Label>
              <Input
                placeholder="e.g. RAG Architecture & Retrieval Systems"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="h-8 text-xs bg-background"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-medium text-foreground">Importance</Label>
              <select
                value={formImportance}
                onChange={(e) => setFormImportance(e.target.value as any)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="high">High Importance</option>
                <option value="medium">Medium Importance</option>
                <option value="low">Low Importance</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] font-medium text-foreground">
              What will be evaluated (Description)
            </Label>
            <Textarea
              rows={2}
              placeholder="Evaluate the candidate's understanding of document chunking, embedding models, vector databases and retrieval accuracy."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="text-xs bg-background leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-foreground">
              Key Aspects & Important Concepts
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type skill or concept and press Enter (or comma separated)"
                value={aspectInput}
                onChange={(e) => setAspectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    handleAddAspect()
                  }
                }}
                className="h-8 text-xs bg-background flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddAspect}
                className="h-8 text-xs px-2.5"
              >
                Add Aspect
              </Button>
            </div>
            {formAspects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {formAspects.map((aspect, aIdx) => (
                  <Badge
                    key={aIdx}
                    variant="secondary"
                    className="text-[10px] pl-2 pr-1 py-0.5 gap-1 flex items-center bg-background border border-border"
                  >
                    <span>{aspect}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAspect(aspect)}
                      className="text-muted-foreground hover:text-foreground rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-primary/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              className="h-7 text-xs px-3"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveForm}
              className="h-7 text-xs px-3 font-semibold gap-1"
            >
              <Check className="size-3.5" />
              Save Criterion
            </Button>
          </div>
        </div>
      )}

      {/* Criteria Cards List */}
      <div className="flex flex-col gap-2.5">
        {criteria.map((criterion, index) => {
          const isBeingEdited = editingId === criterion.id

          if (isBeingEdited) {
            return (
              <div
                key={criterion.id}
                className="flex flex-col gap-3 rounded-lg border-2 border-primary/60 bg-muted/40 p-3.5 shadow-xs animate-in fade-in-50 duration-200"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Pencil className="size-3.5" /> Editing Criterion #{index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                {formError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2.5 py-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <Label className="text-[11px] font-medium text-foreground">Criterion Title</Label>
                    <Input
                      placeholder="e.g. RAG Architecture & Retrieval Systems"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="h-8 text-xs bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] font-medium text-foreground">Importance</Label>
                    <select
                      value={formImportance}
                      onChange={(e) => setFormImportance(e.target.value as any)}
                      className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    >
                      <option value="high">High Importance</option>
                      <option value="medium">Medium Importance</option>
                      <option value="low">Low Importance</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] font-medium text-foreground">
                    What will be evaluated (Description)
                  </Label>
                  <Textarea
                    rows={2}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="text-xs bg-background leading-relaxed"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-medium text-foreground">
                    Key Aspects & Important Concepts
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add another aspect (e.g. Chunking, Embeddings)"
                      value={aspectInput}
                      onChange={(e) => setAspectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          handleAddAspect()
                        }
                      }}
                      className="h-8 text-xs bg-background flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddAspect}
                      className="h-8 text-xs px-2.5"
                    >
                      Add
                    </Button>
                  </div>
                  {formAspects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {formAspects.map((aspect, aIdx) => (
                        <Badge
                          key={aIdx}
                          variant="secondary"
                          className="text-[10px] pl-2 pr-1 py-0.5 gap-1 flex items-center bg-background border border-border"
                        >
                          <span>{aspect}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAspect(aspect)}
                            className="text-muted-foreground hover:text-foreground rounded-full hover:bg-muted p-0.5"
                          >
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="h-7 text-xs px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveForm}
                    className="h-7 text-xs px-3 font-semibold gap-1"
                  >
                    <Check className="size-3.5" />
                    Save Changes
                  </Button>
                </div>
              </div>
            )
          }

          // Normal Display Card
          return (
            <div
              key={criterion.id}
              className="group relative flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/15 hover:bg-muted/30 hover:border-border transition-colors p-3.5"
            >
              {/* Card Top Row: Index, Title, Importance, and Actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-xs font-bold font-mono text-muted-foreground/80 mt-0.5 shrink-0">
                    {index + 1}.
                  </span>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground leading-snug">
                        {criterion.title}
                      </span>
                      {getImportanceBadge(criterion.importance || "high")}
                    </div>
                  </div>
                </div>

                {/* Reorder and Edit/Delete Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move criterion up"
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || index === criteria.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move criterion down"
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || editingId !== null}
                    onClick={() => startEdit(criterion)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit criterion"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || editingId !== null || criteria.length <= 1}
                    onClick={() => handleDelete(criterion.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    title="Delete criterion"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-foreground/85 leading-relaxed pl-5">
                {criterion.description}
              </p>

              {/* Key Aspects */}
              {criterion.keyAspects && criterion.keyAspects.length > 0 && (
                <div className="flex items-center gap-1.5 pl-5 pt-0.5 text-[11px] text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground/75 flex items-center gap-1">
                    <Tag className="size-2.5 text-muted-foreground" />
                    Key aspects:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {criterion.keyAspects.map((aspect, aIdx) => (
                      <Badge
                        key={aIdx}
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 py-0 font-normal border-border/80 bg-background/60"
                      >
                        {aspect}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom Explanatory Notice */}
      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground leading-relaxed mt-1">
        <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          These criteria guide the AI interviewer&apos;s questions and the final candidate evaluation. Actual
          interview questions are generated dynamically during the interview.
        </span>
      </div>
    </div>
  )
}
