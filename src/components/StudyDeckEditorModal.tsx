import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { validateGeneratedPracticeItems } from '@/lib/practiceItemValidation'
import type { Flashcard, PracticeItem, PracticeType, ReviewMaterial } from '@/types'
import { Badge, Button, Icon, Input, Modal, useToast } from '@/components/ui'

type EditableType = 'flashcards' | PracticeType
type FlashcardRow = Flashcard & { hint: string | null }
type PracticeItemRow = PracticeItem & { hint: string | null }
type ActiveItem = { kind: 'flashcard' | 'practice'; id: string | null; type: EditableType }
type Draft = {
  prompt: string
  context: string
  answer: string
  hint: string
  options: string[]
  correctIndex: number
  acceptable: string
  items: string
  answerItems: string
}

interface StudyDeckEditorModalProps {
  open: boolean
  material: ReviewMaterial
  onClose: () => void
  onMaterialTitleChange: (title: string) => void
  onContentChange: () => void
}

const practiceTypeTitles: Record<PracticeType, string> = {
  mcq: 'Multiple choice',
  diagnosis: 'Diagnosis',
  sequence: 'Sequence',
  flashcard_drill: 'Active recall',
  enumeration: 'Enumeration',
  identification: 'Identification',
}

function blankDraft(): Draft {
  return {
    prompt: '',
    context: '',
    answer: '',
    hint: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    acceptable: '',
    items: '',
    answerItems: '',
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asLines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string') : []
}

function lines(value: string) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

function draftFromFlashcard(card: FlashcardRow): Draft {
  return { ...blankDraft(), prompt: card.front, answer: card.back, hint: card.hint || '' }
}

function draftFromPracticeItem(item: PracticeItemRow): Draft {
  const question = asObject(item.question)
  const answer = asObject(item.answer)
  return {
    ...blankDraft(),
    prompt: asText(question.stem) || asText(question.prompt),
    context: asText(question.scenario),
    answer: asText(answer.expected),
    hint: item.hint || '',
    options: asLines(question.options).concat(['', '', '', '']).slice(0, 4),
    correctIndex: Number.isInteger(answer.correctIndex) ? Number(answer.correctIndex) : 0,
    acceptable: asLines(answer.acceptable).join('\n'),
    items: asLines(question.items).join('\n'),
    answerItems: asLines(answer.order || answer.items).join('\n'),
  }
}

function typeLabel(type: EditableType) {
  return type === 'flashcards' ? 'Flashcard' : practiceTypeTitles[type]
}

export default function StudyDeckEditorModal({
  open,
  material,
  onClose,
  onMaterialTitleChange,
  onContentChange,
}: StudyDeckEditorModalProps) {
  const { profile } = useAuth()
  const { addToast } = useToast()
  const [title, setTitle] = useState(material.title)
  const [flashcards, setFlashcards] = useState<FlashcardRow[]>([])
  const [practiceItems, setPracticeItems] = useState<PracticeItemRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newType, setNewType] = useState<EditableType>('flashcards')
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [pendingDelete, setPendingDelete] = useState<{ kind: ActiveItem['kind']; id: string; label: string } | null>(null)

  useEffect(() => {
    setTitle(material.title)
    setActiveItem(null)
    setPendingDelete(null)
    setError(null)
  }, [material.id, material.title])

  const loadContent = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    try {
      const [cardsResult, practiceResult] = await Promise.all([
        supabase.from('flashcards').select('*').eq('user_id', profile.id).eq('material_id', material.id).order('created_at'),
        supabase.from('practice_items').select('*').eq('user_id', profile.id).eq('material_id', material.id).order('created_at'),
      ])
      if (cardsResult.error) throw new Error(cardsResult.error.message)
      if (practiceResult.error) throw new Error(practiceResult.error.message)
      setFlashcards((cardsResult.data || []) as FlashcardRow[])
      setPracticeItems((practiceResult.data || []) as PracticeItemRow[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load study content.')
    } finally {
      setLoading(false)
    }
  }, [material.id, profile])

  useEffect(() => {
    if (open) void loadContent()
  }, [loadContent, open])

  async function saveTitle() {
    if (!profile) return
    const nextTitle = title.trim()
    if (!nextTitle || nextTitle === material.title) return
    setSavingTitle(true)
    setError(null)
    try {
      const { data, error: renameError } = await supabase.rpc('rename_review_material', {
        p_material_id: material.id,
        p_title: nextTitle,
      })
      if (renameError) throw new Error(renameError.message)
      if (typeof data !== 'string' || !data.trim()) throw new Error('The deck title was not updated.')
      setTitle(data)
      onMaterialTitleChange(data)
      addToast({ type: 'success', title: 'Study set renamed', message: data })
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename study set.')
    } finally {
      setSavingTitle(false)
    }
  }

  function editFlashcard(card: FlashcardRow) {
    setPendingDelete(null)
    setActiveItem({ kind: 'flashcard', id: card.id, type: 'flashcards' })
    setDraft(draftFromFlashcard(card))
    setError(null)
  }

  function editPracticeItem(item: PracticeItemRow) {
    setPendingDelete(null)
    setActiveItem({ kind: 'practice', id: item.id, type: item.type })
    setDraft(draftFromPracticeItem(item))
    setError(null)
  }

  function addItem() {
    setPendingDelete(null)
    const kind = newType === 'flashcards' ? 'flashcard' : 'practice'
    setActiveItem({ kind, id: null, type: newType })
    setDraft(blankDraft())
    setError(null)
  }

  function makePracticeContent(type: PracticeType) {
    const question = type === 'mcq'
      ? { stem: draft.prompt.trim(), options: draft.options.map(option => option.trim()) }
      : type === 'diagnosis' || type === 'identification'
        ? { scenario: draft.context.trim(), prompt: draft.prompt.trim() }
        : type === 'sequence'
          ? { prompt: draft.prompt.trim(), items: lines(draft.items) }
          : type === 'enumeration'
            ? { prompt: draft.prompt.trim() }
            : { stem: draft.prompt.trim() }
    const answer = type === 'mcq'
      ? { correctIndex: draft.correctIndex }
      : type === 'diagnosis' || type === 'identification'
        ? { expected: draft.answer.trim(), ...(lines(draft.acceptable).length ? { acceptable: lines(draft.acceptable) } : {}) }
        : type === 'sequence'
          ? { order: lines(draft.answerItems) }
          : type === 'enumeration'
            ? { items: lines(draft.answerItems) }
            : { expected: draft.answer.trim() }
    try {
      const [validated] = validateGeneratedPracticeItems(
        [{ question, answer }],
        type,
        material.subject,
        material.board_program,
      )
      return { question: validated.question, answer: validated.answer }
    } catch (validationError) {
      const reason = validationError instanceof Error
        ? validationError.message.replace(/^AI returned an invalid [\w_]+ item at position \d+: /, '')
        : 'question or answer fields are missing or inconsistent.'
      throw new Error(`Please review the question and answer: ${reason}`)
    }
  }

  async function saveItem() {
    if (!profile || !activeItem) return
    setSavingItem(true)
    setError(null)
    try {
      if (activeItem.kind === 'flashcard') {
        const front = draft.prompt.trim()
        const back = draft.answer.trim()
        if (!front || !back) throw new Error('Enter both a question and an answer.')
        const content = {
          front,
          back,
          hint: draft.hint.trim() || null,
          ease_factor: 2.5,
          interval_minutes: 0,
          repetitions: 0,
          next_review_at: new Date().toISOString(),
          last_reviewed_at: null,
          last_quality: null,
        }
        if (activeItem.id) {
          const { data: updatedCard, error: updateError } = await supabase.from('flashcards').update(content)
            .eq('id', activeItem.id).eq('material_id', material.id).eq('user_id', profile.id).select('id').single()
          if (updateError) throw new Error(updateError.message)
          if (!updatedCard) throw new Error('Flashcard not found.')
        } else {
          const { error: insertError } = await supabase.from('flashcards').insert({
            ...content,
            user_id: profile.id,
            material_id: material.id,
            board_program: material.board_program,
            subject: material.subject,
          })
          if (insertError) throw new Error(insertError.message)
        }
      } else {
        const type = activeItem.type as PracticeType
        const { question, answer } = makePracticeContent(type)
        if (activeItem.id) {
          const { error: updateError } = await supabase.rpc('update_review_practice_item', {
            p_item_id: activeItem.id,
            p_material_id: material.id,
            p_question: question,
            p_answer: answer,
            p_hint: draft.hint.trim() || null,
          })
          if (updateError) throw new Error(updateError.message)
        } else {
          const { error: insertError } = await supabase.from('practice_items').insert({
            user_id: profile.id,
            material_id: material.id,
            board_program: material.board_program,
            subject: material.subject,
            type,
            question,
            answer,
            rationale: null,
            hint: draft.hint.trim() || null,
          })
          if (insertError) throw new Error(insertError.message)
        }
      }

      setActiveItem(null)
      onContentChange()
      await loadContent()
      addToast({
        type: 'success',
        title: activeItem.id ? 'Study content updated' : 'Study content added',
        message: activeItem.id
          ? 'Previous practice attempts or review scheduling were reset for the edited item.'
          : 'Your new question is ready to study.',
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save study content.')
    } finally {
      setSavingItem(false)
    }
  }

  async function deleteItem(target: NonNullable<typeof pendingDelete>) {
    if (!profile) return
    setSavingItem(true)
    setError(null)
    try {
      const table = target.kind === 'flashcard' ? 'flashcards' : 'practice_items'
      const { data: deletedItem, error: deleteError } = await supabase.from(table).delete()
        .eq('id', target.id).eq('material_id', material.id).eq('user_id', profile.id).select('id').single()
      if (deleteError) throw new Error(deleteError.message)
      if (!deletedItem) throw new Error('Study content not found.')
      setPendingDelete(null)
      onContentChange()
      await loadContent()
      addToast({ type: 'success', title: 'Study content removed', message: target.label })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove study content.')
    } finally {
      setSavingItem(false)
    }
  }

  const availableTypes: EditableType[] = profile?.track === 'course'
    ? ['flashcards', 'mcq', 'identification', 'enumeration', 'flashcard_drill']
    : ['flashcards', 'mcq', 'diagnosis', 'sequence', 'flashcard_drill']
  const editingType = activeItem?.type

  return (
    <Modal
      open={open}
      onClose={() => { if (!savingItem && !savingTitle) onClose() }}
      title={`Edit ${material.title}`}
      description="Rename this study set, correct generated content, or add questions and flashcards."
      size="xl"
      closeOnOverlayClick={!savingItem && !savingTitle}
      closeOnEscape={!savingItem && !savingTitle}
    >
      <div className="reviewer-editor">
        <div className="reviewer-editor-title">
          <label htmlFor="study-deck-title">Study set name</label>
          <div className="reviewer-editor-title-row">
            <Input id="study-deck-title" value={title} maxLength={160} onChange={event => setTitle(event.target.value)} />
            <Button variant="secondary" onClick={() => void saveTitle()} loading={savingTitle} disabled={!title.trim() || title.trim() === material.title}>
              Save name
            </Button>
          </div>
        </div>

        <p className="reviewer-editor-reset-note">
          <Icon name="info" size={16} aria-hidden="true" />
          Editing a question clears its prior attempts; editing a flashcard resets its review schedule.
        </p>

        {error && <div className="reviewer-editor-error" role="alert">{error}</div>}

        {activeItem ? (
          <section className="reviewer-editor-form" aria-labelledby="reviewer-editor-form-title">
            <div className="reviewer-editor-form-heading">
              <h3 id="reviewer-editor-form-title">{activeItem.id ? 'Edit' : 'Add'} {typeLabel(activeItem.type)}</h3>
              <Button variant="ghost" size="icon" aria-label="Close editor" title="Close editor" onClick={() => setActiveItem(null)}>
                <Icon name="x" size={18} aria-hidden="true" />
              </Button>
            </div>
            {editingType === 'mcq' ? (
              <>
                <label className="reviewer-editor-field">
                  Question
                  <textarea value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} rows={3} />
                </label>
                <div className="reviewer-editor-options">
                  {draft.options.map((option, index) => (
                    <label className="reviewer-editor-field" key={index}>
                      Answer choice {index + 1}
                      <Input value={option} onChange={event => setDraft({
                        ...draft,
                        options: draft.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value),
                      })} />
                    </label>
                  ))}
                </div>
                <label className="reviewer-editor-field">
                  Correct answer
                  <select value={draft.correctIndex} onChange={event => setDraft({ ...draft, correctIndex: Number(event.target.value) })}>
                    {draft.options.map((option, index) => <option value={index} key={index}>Choice {index + 1}{option.trim() ? `: ${option.trim()}` : ''}</option>)}
                  </select>
                </label>
              </>
            ) : editingType === 'diagnosis' || editingType === 'identification' ? (
              <>
                <label className="reviewer-editor-field">
                  Context / scenario
                  <textarea value={draft.context} onChange={event => setDraft({ ...draft, context: event.target.value })} rows={3} />
                </label>
                <label className="reviewer-editor-field">
                  Question
                  <textarea value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} rows={2} />
                </label>
                <label className="reviewer-editor-field">
                  Answer
                  <Input value={draft.answer} onChange={event => setDraft({ ...draft, answer: event.target.value })} />
                </label>
                <label className="reviewer-editor-field">
                  Other accepted answers (optional, one per line)
                  <textarea value={draft.acceptable} onChange={event => setDraft({ ...draft, acceptable: event.target.value })} rows={2} />
                </label>
              </>
            ) : editingType === 'sequence' ? (
              <>
                <label className="reviewer-editor-field">
                  Question
                  <textarea value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} rows={2} />
                </label>
                <label className="reviewer-editor-field">
                  Items to arrange (one per line)
                  <textarea value={draft.items} onChange={event => setDraft({ ...draft, items: event.target.value })} rows={4} />
                </label>
                <label className="reviewer-editor-field">
                  Correct order (one item per line)
                  <textarea value={draft.answerItems} onChange={event => setDraft({ ...draft, answerItems: event.target.value })} rows={4} />
                </label>
              </>
            ) : editingType === 'enumeration' ? (
              <>
                <label className="reviewer-editor-field">
                  Question
                  <textarea value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} rows={3} />
                </label>
                <label className="reviewer-editor-field">
                  Answer items (one per line)
                  <textarea value={draft.answerItems} onChange={event => setDraft({ ...draft, answerItems: event.target.value })} rows={4} />
                </label>
              </>
            ) : (
              <>
                <label className="reviewer-editor-field">
                  Question
                  <textarea value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} rows={3} />
                </label>
                <label className="reviewer-editor-field">
                  Answer
                  <textarea value={draft.answer} onChange={event => setDraft({ ...draft, answer: event.target.value })} rows={3} />
                </label>
              </>
            )}
            <label className="reviewer-editor-field">
              Hint (optional)
              <textarea value={draft.hint} onChange={event => setDraft({ ...draft, hint: event.target.value })} rows={2} />
            </label>
            <div className="reviewer-editor-form-actions">
              <Button variant="secondary" onClick={() => setActiveItem(null)} disabled={savingItem}>Cancel</Button>
              <Button variant="primary" leftIcon="save" onClick={() => void saveItem()} loading={savingItem}>Save content</Button>
            </div>
          </section>
        ) : (
          <>
            <div className="reviewer-editor-add-row">
              <label htmlFor="new-study-item-type">Add content</label>
              <select id="new-study-item-type" value={newType} onChange={event => setNewType(event.target.value as EditableType)}>
                {availableTypes.map(type => <option value={type} key={type}>{typeLabel(type)}</option>)}
              </select>
              <Button variant="primary" leftIcon="plus" onClick={addItem}>Add item</Button>
            </div>
            {loading ? (
              <p className="reviewer-editor-loading" role="status">Loading study content…</p>
            ) : flashcards.length + practiceItems.length === 0 ? (
              <p className="reviewer-editor-empty">This study set has no cards or questions yet.</p>
            ) : (
              <div className="reviewer-editor-list">
                {flashcards.map(card => (
                  <div className="reviewer-editor-item" key={card.id}>
                    <div className="reviewer-editor-item-copy">
                      <Badge variant="primary" size="sm">Flashcard</Badge>
                      <strong>{card.front}</strong>
                      <span>{card.back}</span>
                    </div>
                    <div className="reviewer-editor-item-actions">
                      <Button variant="ghost" size="icon" leftIcon="edit" aria-label="Edit flashcard" title="Edit" onClick={() => editFlashcard(card)} />
                      {pendingDelete?.id === card.id ? (
                        <>
                          <Button variant="danger" size="sm" onClick={() => void deleteItem(pendingDelete)} loading={savingItem}>Confirm remove</Button>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button variant="danger" size="icon" leftIcon="trash" aria-label="Remove flashcard" title="Remove" onClick={() => setPendingDelete({ kind: 'flashcard', id: card.id, label: card.front })} />
                      )}
                    </div>
                  </div>
                ))}
                {practiceItems.map(item => (
                  <div className="reviewer-editor-item" key={item.id}>
                    <div className="reviewer-editor-item-copy">
                      <Badge variant="default" size="sm">{practiceTypeTitles[item.type]}</Badge>
                      <strong>{asText(asObject(item.question).stem) || asText(asObject(item.question).prompt) || asText(asObject(item.question).scenario)}</strong>
                      <span>{item.rationale || asText(asObject(item.answer).expected) || asLines(asObject(item.answer).items).join(', ') || 'Generated study question'}</span>
                    </div>
                    <div className="reviewer-editor-item-actions">
                      <Button variant="ghost" size="icon" leftIcon="edit" aria-label={`Edit ${practiceTypeTitles[item.type]} question`} title="Edit" onClick={() => editPracticeItem(item)} />
                      {pendingDelete?.id === item.id ? (
                        <>
                          <Button variant="danger" size="sm" onClick={() => void deleteItem(pendingDelete)} loading={savingItem}>Confirm remove</Button>
                          <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button variant="danger" size="icon" leftIcon="trash" aria-label={`Remove ${practiceTypeTitles[item.type]} question`} title="Remove" onClick={() => setPendingDelete({ kind: 'practice', id: item.id, label: asText(asObject(item.question).stem) || asText(asObject(item.question).prompt) || 'Study question' })} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
