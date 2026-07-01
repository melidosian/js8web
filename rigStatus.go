package main

import (
	"errors"

	"github.com/PiotrTopa/js8web/model"
)

var rigStatusCache model.RigStatusWsEvent = model.RigStatusWsEvent{}

func rigStatusNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	newRigStatus, err := model.CreateRigStatusWsEvent(event)
	if err != nil {
		logger.Sugar().Errorw(
			"Can not undertand RIG.STATUS event",
			"event", event,
			"error", err,
		)
		return nil
	}

	if *newRigStatus != rigStatusCache {
		rigStatusCache = *newRigStatus
		websocketEvents <- &rigStatusCache
	}
	return nil
}

func rigPttNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	wsEvent, err := model.CreateRigPttWsEvent(event)
	if err != nil {
		return errors.New("can not convert TxFrame event to db object")
	}
	websocketEvents <- wsEvent
	return nil
}

func rigFreqNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	if event.Params.Dial > 0 || event.Params.Freq > 0 {
		rigStatusCache.Dial = event.Params.Dial
		rigStatusCache.Freq = event.Params.Freq
		rigStatusCache.Offset = event.Params.Offset
		if event.Params.Offset >= 25 {
			rigStatusCache.Channel = uint16((uint32(event.Params.Offset) - 25) / 50)
		}
		websocketEvents <- &rigStatusCache
	}
	return nil
}

func modeSpeedNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	speedNames := map[int]string{0: "normal", 1: "fast", 2: "turbo", 4: "slow", 8: "ultra"}
	if name, ok := speedNames[event.Params.Speed]; ok && name != rigStatusCache.Speed {
		rigStatusCache.Speed = name
		websocketEvents <- &rigStatusCache
	}
	return nil
}
