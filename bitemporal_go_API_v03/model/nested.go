package model

import (
	"context"

	"github.com/uptrace/bun"
)

type User struct {
    ID       int64     `bun:"id,pk,autoincrement"`
    Name     string    `bun:"name"`
    
    // De bestaande 1-op-veel relatie
    Articles []Article `bun:"rel:has-many,join:id=author_id"`
    
    // De nieuwe 1-op-1 relatie
    // Let op: 'rel:has-one' omdat de FK (user_id) in de CV tabel staat
    CV       *CV       `bun:"rel:has-one,join:id=user_id"`
}

type CV struct {
    ID        int64  `bun:"id,pk,autoincrement"`
    Education string `bun:"education"`
    Experience string `bun:"experience"`
    UserID    int64  `bun:"user_id"` // De foreign key
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
    Relation("Articles"). // Laad alle artikelen
    Relation("CV").       // Laad ook het CV
    Scan(ctx)

	if err != nil {
		return nil, err
	}

	return users, nil
}
