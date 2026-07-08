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

func sendConnectEvents(writer *bufio.Writer) {
	initTypes := []string{
		model.EVENT_TYPE_INBOX_GET_MESSAGES,
		model.EVENT_TYPE_RIG_GET_FREQ,
		model.EVENT_TYPE_MODE_GET_SPEED,
		model.EVENT_TYPE_STATION_GET_CALLSIGN,
		model.EVENT_TYPE_STATION_GET_GRID,
		model.EVENT_TYPE_STATION_GET_INFO,
		model.EVENT_TYPE_STATION_GET_STATUS,
	}
	for _, t := range initTypes {
		data, err := json.Marshal(model.Js8callEvent{Type: t})
		if err != nil {
			continue
		}
		writer.WriteString(string(data) + "\n")
	}
	writer.Flush()
}

func attachEventStreamToJs8callConnection(incomingEvents chan<- model.Js8callEvent, outgoingEvents <-chan model.Js8callEvent, conn net.Conn) {
	disconnected := make(chan int)
	incomingJs8callEvents := make(chan model.Js8callEvent, 1)
	outgoingJs8callEvents := make(chan model.Js8callEvent, 1)

	defer close(incomingJs8callEvents)
	defer close(outgoingJs8callEvents)
	defer close(disconnected)

	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)

	sendConnectEvents(writer)

	go readEventsFromJs8call(incomingJs8callEvents, disconnected, reader)
	go writeEventsToJs8call(outgoingJs8callEvents, disconnected, writer)

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
