import Head from 'next/head'
import { useState, useEffect, FormEvent } from 'react'
import Layout from '../components/layout/Layout'
import { tasks as tasksApi, Board, Column, Card } from '../lib/api'
import styles from '../styles/Tasks.module.css'

const DEFAULT_COLUMNS = ['Backlog', 'In progress', 'Review', 'Done']

export default function TasksPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [newBoardName, setNewBoardName] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [newCardColumn, setNewCardColumn] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [newCardAssignee, setNewCardAssignee] = useState('')
  const [dragging, setDragging] = useState<Card | null>(null)

  useEffect(() => {
    tasksApi.listBoards().then(async r => {
      setBoards(r.items)
      const board = r.items.find(b => b.isDefault) ?? r.items[0]
      if (board) await loadBoard(board)
      else setActiveBoard(null)
    })
  }, [])

  async function loadBoard(board: Board) {
    setActiveBoard(board)
    const [cols, cds] = await Promise.all([
      tasksApi.listColumns(board.id),
      tasksApi.listCards(board.id),
    ])
    setColumns(cols.items.sort((a, b) => a.order - b.order))
    setCards(cds.items)
  }

  async function createBoard(e: FormEvent) {
    e.preventDefault()
    const board = await tasksApi.createBoard(newBoardName)
    // Create default columns
    for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
      await tasksApi.createColumn(board.id, DEFAULT_COLUMNS[i], i)
    }
    setBoards(prev => [...prev, board])
    setNewBoardName('')
    setCreatingBoard(false)
    await loadBoard(board)
  }

  async function addCard(columnId: string) {
    if (!activeBoard || !newCardTitle.trim()) return
    const card = await tasksApi.createCard(activeBoard.id, {
      columnId,
      boardId: activeBoard.id,
      title: newCardTitle,
      description: '',
      assignee: newCardAssignee,
      order: cards.filter(c => c.columnId === columnId).length,
    })
    setCards(prev => [...prev, card])
    setNewCardTitle('')
    setNewCardAssignee('')
    setNewCardColumn(null)
  }

  async function moveCard(card: Card, targetColumnId: string) {
    const updated = await tasksApi.updateCard(card.id, { columnId: targetColumnId })
    setCards(prev => prev.map(c => c.id === card.id ? updated : c))
  }

  async function deleteCard(id: string) {
    await tasksApi.deleteCard(id)
    setCards(prev => prev.filter(c => c.id !== id))
  }

  function onDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault()
  }

  function onDrop(e: React.DragEvent, colId: string) {
    e.preventDefault()
    if (dragging && dragging.columnId !== colId) {
      moveCard(dragging, colId)
    }
    setDragging(null)
  }

  return (
    <>
      <Head><title>Tasks — Socioscope</title></Head>
      <Layout title="Tasks">
        {/* Board switcher */}
        <div className={styles.boardBar}>
          <div className={styles.boardTabs}>
            {boards.map(b => (
              <button
                key={b.id}
                onClick={() => loadBoard(b)}
                className={`${styles.boardTab} ${activeBoard?.id === b.id ? styles.boardTabActive : ''}`}
              >
                {b.name}
              </button>
            ))}
            <button onClick={() => setCreatingBoard(v => !v)} className={styles.newBoardBtn}>
              + New board
            </button>
          </div>
        </div>

        {creatingBoard && (
          <form onSubmit={createBoard} className={styles.newBoardForm}>
            <input
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              placeholder="Board name"
              required autoFocus
              className={styles.input}
            />
            <button type="submit" className={styles.submitBtn}>Create</button>
            <button type="button" onClick={() => setCreatingBoard(false)} className={styles.cancelBtn}>Cancel</button>
          </form>
        )}

        {!activeBoard && !creatingBoard && (
          <p style={{ color: 'var(--color-warm-gray)', fontSize: 14 }}>
            No boards yet. Create one above.
          </p>
        )}

        {activeBoard && (
          <div className={styles.kanban}>
            {columns.map(col => {
              const colCards = cards.filter(c => c.columnId === col.id)
                .sort((a, b) => a.order - b.order)
              return (
                <div
                  key={col.id}
                  className={styles.column}
                  onDragOver={e => onDragOver(e, col.id)}
                  onDrop={e => onDrop(e, col.id)}
                >
                  <div className={styles.colHeader}>
                    <span className={styles.colName}>{col.name}</span>
                    <span className={styles.colCount}>{colCards.length}</span>
                  </div>

                  <div className={styles.cards}>
                    {colCards.map(card => (
                      <div
                        key={card.id}
                        className={styles.card}
                        draggable
                        onDragStart={() => setDragging(card)}
                        onDragEnd={() => setDragging(null)}
                      >
                        <p className={styles.cardTitle}>{card.title}</p>
                        {card.assignee && (
                          <span className={styles.cardAssignee}>{card.assignee}</span>
                        )}
                        <button
                          onClick={() => deleteCard(card.id)}
                          className={styles.cardDelete}
                        >×</button>
                      </div>
                    ))}
                  </div>

                  {newCardColumn === col.id ? (
                    <div className={styles.addCardForm}>
                      <input
                        value={newCardTitle}
                        onChange={e => setNewCardTitle(e.target.value)}
                        placeholder="Card title"
                        autoFocus
                        className={styles.input}
                        onKeyDown={e => e.key === 'Enter' && addCard(col.id)}
                      />
                      <input
                        value={newCardAssignee}
                        onChange={e => setNewCardAssignee(e.target.value)}
                        placeholder="Assignee (optional)"
                        className={styles.input}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => addCard(col.id)} className={styles.submitBtn}>Add</button>
                        <button onClick={() => setNewCardColumn(null)} className={styles.cancelBtn}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewCardColumn(col.id)}
                      className={styles.addCardBtn}
                    >
                      + Add card
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Layout>
    </>
  )
}
