package httpapi

import (
	"github.com/go-chi/chi/v5"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerBotRoutes mounts the bot endpoints. It is called from within the
// authenticated /api scope, so it adds no auth middleware of its own.
func registerBotRoutes(r chi.Router, bots *service.BotService) {
	serve(r, "/bots", map[string]http.HandlerFunc{
		http.MethodGet:  listBotsHandler(bots),
		http.MethodPost: createBotHandler(bots),
	})
	serve(r, "/bots/reorder", map[string]http.HandlerFunc{
		http.MethodPut: reorderBotsHandler(bots),
	})
	serve(r, "/bots/{id}", map[string]http.HandlerFunc{
		http.MethodGet:    getBotHandler(bots),
		http.MethodPut:    updateBotHandler(bots),
		http.MethodDelete: deleteBotHandler(bots),
	})

	serve(r, "/memos/{id}/bot-replies", map[string]http.HandlerFunc{
		http.MethodGet: getBotRepliesHandler(bots),
	})
	serve(r, "/bot-replies/{id}/thread", map[string]http.HandlerFunc{
		http.MethodGet: getBotThreadHandler(bots),
	})
	serve(r, "/memos/{id}/trigger-replies", map[string]http.HandlerFunc{
		http.MethodPost: triggerRepliesHandler(bots),
	})
	serve(r, "/bot-replies/{id}/reply", map[string]http.HandlerFunc{
		http.MethodPost: replyToBotHandler(bots),
	})
}
