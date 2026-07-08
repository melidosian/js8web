package model

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var (
	SQL_RX_SPOT_INSERT = "INSERT INTO `RX_SPOT` (`TIMESTAMP`, `CALL`, `GRID`, `SNR`, `CHANNEL`, `DIAL`, `FREQ`, `OFFSET`) values(?, ?, ?, ?, ?, ?, ?, ?)"
	SQL_RX_SPOT_LIST   = "SELECT `ID`, `TIMESTAMP`, `CALL`, `GRID`, `SNR`, `CHANNEL`, `DIAL`, `FREQ`, `OFFSET` FROM `RX_SPOT` ORDER BY `TIMESTAMP` DESC LIMIT 200"
)

type RxSpotObj struct {
	Id        int64
	Timestamp time.Time
	Call      string
	Grid      string
	Snr       int16
	Channel   uint16
	Dial      uint32
	Freq      uint32
	Offset    uint16
}

func (o *RxSpotObj) WsType() string {
	return WS_OBJ_TYPE_RX_SPOT
}

func CreateRxSpotObj(event *Js8callEvent) (*RxSpotObj, error) {
	if event.Type != EVENT_TYPE_RX_SPOT {
		return nil, errors.New("wrong event type, cannot parse params")
	}

	o := new(RxSpotObj)
	// RX.SPOT carries no timestamp field at all (unlike RX.ACTIVITY/RX.DIRECTED) — stamp
	// it with our own receive time instead of the always-zero event.Params.UTC.
	o.Timestamp = time.Now().UTC()
	o.Call = event.Params.Call
	o.Grid = event.Params.Grid
	o.Snr = event.Params.Snr
	o.Dial = event.Params.Dial
	o.Channel = CalcChannelFromOffset(event.Params.Offset)
	o.Freq = event.Params.Freq
	o.Offset = event.Params.Offset

	return o, nil
}

func (obj *RxSpotObj) Insert(db *sql.DB) error {
	stmt, err := db.Prepare(SQL_RX_SPOT_INSERT)
	if err != nil {
		return fmt.Errorf("error inserting new RxSpot record, caused by %w", err)
	}
	defer stmt.Close()

	res, err := stmt.Exec(
		toSqlTime(obj.Timestamp),
		&obj.Call,
		&obj.Grid,
		&obj.Snr,
		&obj.Channel,
		&obj.Dial,
		&obj.Freq,
		&obj.Offset,
	)
	if err != nil {
		return fmt.Errorf("error inserting new RxSpot record, caused by %w", err)
	}

	obj.Id, _ = res.LastInsertId()
	return nil
}

func (obj *RxSpotObj) Save(db *sql.DB) error {
	return obj.Insert(db)
}

func (obj *RxSpotObj) Scan(rows *sql.Rows) error {
	var timestamp string
	err := rows.Scan(
		&obj.Id,
		&timestamp,
		&obj.Call,
		&obj.Grid,
		&obj.Snr,
		&obj.Channel,
		&obj.Dial,
		&obj.Freq,
		&obj.Offset,
	)
	if err != nil {
		return err
	}

	obj.Timestamp, err = fromSqlTime(timestamp)
	return err
}

// FetchRecentRxSpots returns the most recent spots, newest first. Spots are a live/recent
// activity view (matching JS8Call's own spot window) rather than a deep historical log, so
// this is a bounded recent list rather than before/after pagination.
func FetchRecentRxSpots(db *sql.DB) ([]RxSpotObj, error) {
	l := make([]RxSpotObj, 0)

	rows, err := db.Query(SQL_RX_SPOT_LIST)
	if err != nil {
		return l, fmt.Errorf("error querying rx spots, caused by %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		obj := RxSpotObj{}
		if err := obj.Scan(rows); err != nil {
			return l, err
		}
		obj.Call = trim(obj.Call)
		obj.Grid = trim(obj.Grid)
		l = append(l, obj)
	}
	return l, rows.Err()
}
