package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func listBotsHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		views, err := bots.ListBots(r.Context(), userID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toBotViewResponses(views))
	}
}

func createBotHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		var req createBotRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		bot, err := bots.CreateBot(r.Context(), userID, req.toInput())
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusCreated, toBotResponse(bot))
	}
}

func getBotHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		botID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		bot, err := bots.GetBot(r.Context(), userID, botID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toBotResponse(bot))
	}
}

func updateBotHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		botID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		var req updateBotRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		input, err := req.toInput()
		if err != nil {
			writeError(w, r, err)
			return
		}
		bot, err := bots.UpdateBot(r.Context(), userID, botID, input)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toBotResponse(bot))
	}
}

func deleteBotHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		botID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if err := bots.DeleteBot(r.Context(), userID, botID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func reorderBotsHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		var req reorderBotsRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		order, err := parseUUIDList(req.Order)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if err := bots.ReorderBots(r.Context(), userID, order); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func getBotRepliesHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		replies, err := bots.GetBotReplies(r.Context(), userID, memoID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toBotReplyNodeResponses(replies))
	}
}

func getBotThreadHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		replyID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		thread, err := bots.GetBotThread(r.Context(), userID, replyID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusOK, toBotThreadResponse(thread))
	}
}

func triggerRepliesHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		memoID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if err := bots.TriggerReplies(r.Context(), userID, memoID); err != nil {
			writeError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

func replyToBotHandler(bots *service.BotService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		replyID, err := pathIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		var req replyToBotRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, r, err)
			return
		}
		resourceIDs, err := parseUUIDList(req.ResourceIDs)
		if err != nil {
			writeError(w, r, err)
			return
		}
		node, err := bots.ReplyToBot(r.Context(), userID, replyID, req.Question, resourceIDs)
		if err != nil {
			writeError(w, r, err)
			return
		}
		WriteJSON(w, http.StatusCreated, toBotReplyNodeResponse(node))
	}
}

func pathIDParam(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return uuid.UUID{}, domain.InvalidUUID(err)
	}
	return id, nil
}
