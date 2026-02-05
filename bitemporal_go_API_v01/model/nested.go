package model

import (
	"context"

	"github.com/uptrace/bun"
)

type User struct {
	ID   int64  `bun:"id,pk,autoincrement"`
	Name string `bun:"name"`
	// De relatie: 'has-many' vertelt Bun dat er meerdere artikelen bij deze user horen.
	Articles []Article `bun:"rel:has-many,join:id=author_id"`
}

type Article struct {
	ID       int64  `bun:"id,pk,autoincrement"`
	Title    string `bun:"title"`
	Content  string `bun:"content"`
	AuthorID int64  `bun:"author_id"`
}

func GetUser(db *bun.DB) ([]User, error) {
	ctx := context.Background()
	users := make([]User, 0)

	err := db.NewSelect().
		Model(&users).
		Relation("Articles"). // Gebruik de naam van het veld in de struct
		Order("user.id ASC").
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return users, nil
}
