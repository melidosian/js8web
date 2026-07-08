package main

import (
	"bufio"
	"encoding/json"
	"net"
	"time"

	"github.com/PiotrTopa/js8web/model"
)

func readEventsFromJs8call(events chan<- model.Js8callEvent, disconnected chan<- int, reader *bufio.Reader) {
	for {
		var event model.Js8callEvent
		jsonData, err := reader.ReadBytes('\n')
		if err != nil {
			logger.Sugar().Warnw("Cannot read from Js8Call",
				"error", err,
			)
			disconnected <- 1
			return
		}

		errJson := json.Unmarshal(jsonData, &event)

		if errJson != nil {
			logger.Sugar().Warnw("Cannot unmarshal JSON",
				"json", jsonData,
				"error", errJson,
			)
		} else {
			logger.Sugar().Debugw("Received from JS8Call", "type", event.Type, "json", string(jsonData))
			events <- event
		}
	}
}

func writeEventsToJs8call(events <-chan model.Js8callEvent, disconnected chan<- int, writer *bufio.Writer) {
	for event := range events {
		jsonData, err := json.Marshal(event)
		if err != nil {
			logger.Sugar().Errorw("Cannot marshal JSON for event",
				"event", event,
				"error", err,
			)
			continue
		}
		logger.Sugar().Infow("Sending to JS8Call", "data", string(jsonData))
		_, err = writer.WriteString(string(jsonData) + "\n")
		if err != nil {
			logger.Sugar().Warnw("Cannot write to JS8Call", "error", err)
			disconnected <- 1
			return
		}
		if err = writer.Flush(); err != nil {
			logger.Sugar().Warnw("Cannot flush to JS8Call", "error", err)
			disconnected <- 1
			return
		}
	}
}

// noParamsRequest marshals a JS8Call request with a genuinely empty params object
// ({"params":{}}), matching the documented shape for argument-less GET_ commands.
// model.Js8callEvent can't produce this: its Params field is a fixed struct with no
// omitempty tags, so json.Marshal always fills in all ~25 fields at their zero value.
// That bloated payload is silently ignored by some JS8Call handlers — confirmed live:
// RX.GET_CALL_ACTIVITY/RX.GET_BAND_ACTIVITY never answered it, but respond instantly
// to the minimal form sent here, while RIG.GET_FREQ/MODE.GET_SPEED tolerate either.
type noParamsRequest struct {
	Type   string                 `json:"type"`
	Value  string                 `json:"value"`
	Params map[string]interface{} `json:"params"`
}

func marshalNoParamsRequest(t string) ([]byte, error) {
	return json.Marshal(noParamsRequest{Type: t, Params: map[string]interface{}{}})
}

func sendConnectEvents(writer *bufio.Writer) {
	initTypes := []string{
		model.EVENT_TYPE_INBOX_GET_MESSAGES,
		model.EVENT_TYPE_RIG_GET_FREQ,
		model.EVENT_TYPE_MODE_GET_SPEED,
		model.EVENT_TYPE_STATION_GET_CALLSIGN,
		model.EVENT_TYPE_STATION_GET_GRID,
		model.EVENT_TYPE_STATION_GET_INFO,
		model.EVENT_TYPE_STATION_GET_STATUS,
		model.EVENT_TYPE_RX_GET_CALL_ACTIVITY,
		model.EVENT_TYPE_RX_GET_BAND_ACTIVITY,
	}
	for _, t := range initTypes {
		data, err := marshalNoParamsRequest(t)
		if err != nil {
			continue
		}
		writer.WriteString(string(data) + "\n")
		writer.Flush()
	}
}

// retryUnansweredConnectRequests re-sends RIG.GET_FREQ / MODE.GET_SPEED / RX.GET_CALL_ACTIVITY /
// RX.GET_BAND_ACTIVITY every few seconds if JS8Call never answered the connect-time request —
// seen in practice to sometimes go unanswered (e.g. under connection-pool pressure), unlike
// INBOX.GET_MESSAGES, which JS8Call answers reliably. Each is retried independently until its
// cache is populated, up to a bounded number of attempts, or the connection drops.
func retryUnansweredConnectRequests(writer *bufio.Writer, stop <-chan struct{}) {
	pending := func() map[string]bool {
		return map[string]bool{
			model.EVENT_TYPE_RIG_GET_FREQ:         rigStatusCache.Dial == 0,
			model.EVENT_TYPE_MODE_GET_SPEED:       rigStatusCache.Speed == "",
			model.EVENT_TYPE_RX_GET_CALL_ACTIVITY: len(callActivityCache) == 0,
			model.EVENT_TYPE_RX_GET_BAND_ACTIVITY: len(bandActivityCache) == 0,
		}
	}
	for i := 0; i < 5; i++ {
		select {
		case <-stop:
			return
		case <-time.After(4 * time.Second):
		}
		still := pending()
		anyPending := false
		for t, unanswered := range still {
			if !unanswered {
				continue
			}
			anyPending = true
			if data, err := marshalNoParamsRequest(t); err == nil {
				logger.Sugar().Debugw("Retrying unanswered connect request", "type", t)
				writer.WriteString(string(data) + "\n")
				writer.Flush()
			}
		}
		if !anyPending {
			return
		}
	}
}

func attachEventStreamToJs8callConnection(incomingEvents chan<- model.Js8callEvent, outgoingEvents <-chan model.Js8callEvent, conn net.Conn) {
	disconnected := make(chan int)
	incomingJs8callEvents := make(chan model.Js8callEvent, 1)
	outgoingJs8callEvents := make(chan model.Js8callEvent, 1)
	stopRetry := make(chan struct{})

	defer close(incomingJs8callEvents)
	defer close(outgoingJs8callEvents)
	defer close(disconnected)
	defer close(stopRetry)

	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)

	sendConnectEvents(writer)

	go readEventsFromJs8call(incomingJs8callEvents, disconnected, reader)
	go writeEventsToJs8call(outgoingJs8callEvents, disconnected, writer)
	go retryUnansweredConnectRequests(writer, stopRetry)

	for {
		select {
		case <-disconnected:
			return
		case event := <-incomingJs8callEvents:
			incomingEvents <- event
		case event := <-outgoingEvents:
			outgoingJs8callEvents <- event
		}
	}
}

func keepConnectedToJs8call(incomingEvents chan<- model.Js8callEvent, outgoingEvents <-chan model.Js8callEvent) {
	for {
		conn, err := net.Dial("tcp", JS8CALL_TCP_CONNECTION_STRING)
		if err != nil {
			logger.Sugar().Warnw("Connection to JS8call failed",
				"address", JS8CALL_TCP_CONNECTION_STRING,
				"error", err,
			)
			time.Sleep(time.Second * time.Duration(JS8CALL_TCP_CONNECTION_RETRY_SEC))
			continue
		}
		logger.Sugar().Info("Connected to JS8call")
		attachEventStreamToJs8callConnection(incomingEvents, outgoingEvents, conn)
		logger.Sugar().Warn("Disconnected from JS8call")
	}
}

func initJs8callConnection(incomingEvents chan<- model.Js8callEvent, outgoingEvents <-chan model.Js8callEvent) {
	go keepConnectedToJs8call(incomingEvents, outgoingEvents)
}
