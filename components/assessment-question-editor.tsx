"use client"

import { Trash2 } from "lucide-react"
import type { AssessmentQuestion, Difficulty } from "@/lib/demo-data"
import { questionTypeLabels } from "@/lib/demo-data"
import { Field, nativeSelectClass } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"]

export function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: AssessmentQuestion
  index: number
  onChange: (q: AssessmentQuestion) => void
  onDelete: () => void
}) {
  // The union is patched with a shared partial; the caller-provided `question`
  // guarantees the discriminant `type` stays consistent.
  const patch = (fields: Partial<AssessmentQuestion>) => onChange({ ...question, ...fields } as AssessmentQuestion)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">Q{index + 1}</span>
            <Badge variant="secondary">{questionTypeLabels[question.type]}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Skill evaluated" htmlFor={`skill-${question.id}`}>
            <Input id={`skill-${question.id}`} value={question.skill} onChange={(e) => patch({ skill: e.target.value })} />
          </Field>
          <Field label="Difficulty" htmlFor={`diff-${question.id}`}>
            <select
              id={`diff-${question.id}`}
              className={nativeSelectClass}
              value={question.difficulty}
              onChange={(e) => patch({ difficulty: e.target.value as Difficulty })}
            >
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Question" htmlFor={`q-${question.id}`}>
          <Textarea id={`q-${question.id}`} value={question.question} onChange={(e) => patch({ question: e.target.value })} rows={2} />
        </Field>

        {question.type === "mcq" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Options (select the correct answer)</p>
            {question.options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={question.correctIndex === i}
                  onChange={() => patch({ correctIndex: i })}
                  className="size-4 accent-[var(--color-primary)]"
                  aria-label={`Mark option ${i + 1} correct`}
                />
                <Input
                  value={opt}
                  onChange={(e) => {
                    const options = [...question.options]
                    options[i] = e.target.value
                    patch({ options })
                  }}
                />
              </label>
            ))}
            <Field label="Explanation" htmlFor={`exp-${question.id}`}>
              <Textarea
                id={`exp-${question.id}`}
                value={question.explanation}
                onChange={(e) => patch({ explanation: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
        )}

        {(question.type === "short" || question.type === "coding") && (
          <Field label="Expected answer / key points (one per line)" htmlFor={`kp-${question.id}`}>
            <Textarea
              id={`kp-${question.id}`}
              value={question.keyPoints.join("\n")}
              onChange={(e) => patch({ keyPoints: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })}
              rows={3}
            />
          </Field>
        )}

        {question.type === "coding" && (
          <Field label="Starter code (optional)" htmlFor={`sc-${question.id}`}>
            <Textarea
              id={`sc-${question.id}`}
              value={question.starterCode ?? ""}
              onChange={(e) => patch({ starterCode: e.target.value })}
              rows={3}
              className="font-mono text-xs"
            />
          </Field>
        )}
      </CardContent>
    </Card>
  )
}
