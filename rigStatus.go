package main

import (
	"errors"

	"github.com/PiotrTopa/js8web/model"
)

var rigStatusCache model.RigStatusWsEvent = model.RigStatusWsEvent{}
var lastPttEnabled bool

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
	if wsEvent.Enabled && !lastPttEnabled {
		advancePendingTxText()
	}
	lastPttEnabled = wsEvent.Enabled
	websocketEvents <- wsEvent
	return nil
}

func rigFreqNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	if event.Params.Dial > 0 || event.Params.Freq > 0 {
		updated := rigStatusCache
		updated.Dial = event.Params.Dial
		updated.Freq = event.Params.Freq
		updated.Offset = event.Params.Offset
		if event.Params.Offset >= 25 {
			updated.Channel = model.CalcChannelFromOffset(event.Params.Offset)
		}
		if updated != rigStatusCache {
			rigStatusCache = updated
			websocketEvents <- &rigStatusCache
		}
	}
	return nil
}

func modeSpeedNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	name := model.SpeedName(event.Params.Speed)
	if name != rigStatusCache.Speed {
		rigStatusCache.Speed = name
		websocketEvents <- &rigStatusCache
	}
	return nil
}
