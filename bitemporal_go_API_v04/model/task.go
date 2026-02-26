package model

import "time"

type Task struct {
	ID          string    `json:"id" bun:"id,pk"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	Status      string    `json:"status"`
}
