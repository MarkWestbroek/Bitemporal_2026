package handlers

import (
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/graph"
	"github.com/gin-gonic/gin"
	"github.com/vektah/gqlparser/v2/ast"
)

// GraphQLHandler returns the GraphQL handler configured with gqlgen
func GraphQLHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Create a new resolver with the database
		resolver := &graph.Resolver{DB: DB}

		// Initialize the GraphQL schema with the resolver
		srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))

		// Add transports
		srv.AddTransport(transport.Options{})
		srv.AddTransport(transport.GET{})
		srv.AddTransport(transport.POST{})

		// Cache query documents
		srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

		// Add extensions
		srv.Use(extension.Introspection{})
		srv.Use(extension.AutomaticPersistedQuery{
			Cache: lru.New[string](100),
		})

		srv.ServeHTTP(c.Writer, c.Request)
	}
}

// PlaygroundHandler returns the GraphQL Playground handler
func PlaygroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL Playground", "/graphql/query")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
