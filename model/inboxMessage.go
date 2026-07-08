package model

import (
	"database/sql"
	"fmt"
	"time"
)

var (
	SQL_INBOX_INSERT       = "INSERT OR IGNORE INTO `INBOX_MESSAGE` (`TIMESTAMP`, `CALLSIGN`, `MESSAGE`, `UTC_MS`) VALUES (?, ?, ?, ?)"
	SQL_INBOX_LIST         = "SELECT `ID`, `TIMESTAMP`, `CALLSIGN`, `MESSAGE`, `UTC_MS` FROM `INBOX_MESSAGE` ORDER BY `TIMESTAMP` DESC LIMIT 200"
	SQL_INBOX_FIND_BY_KEYS = "SELECT `ID` FROM `INBOX_MESSAGE` WHERE `CALLSIGN`=? AND `UTC_MS`=? AND `MESSAGE`=?"
)

type InboxMessageObj struct {
	Id        int64     `json:"Id"`
	Timestamp time.Time `json:"Timestamp"`
	Callsign  string    `json:"Callsign"`
	Message   string    `json:"Message"`
	UtcMs     int64     `json:"UtcMs"`
}

func (o *InboxMessageObj) WsType() string { return WS_OBJ_TYPE_INBOX_MESSAGE }

func CreateInboxMessageObj(callsign, message string, utcMs int64) *InboxMessageObj {
	o := &InboxMessageObj{
		Callsign: callsign,
		Message:  message,
		UtcMs:    utcMs,
	}
	if utcMs > 0 {
		o.Timestamp = fromJs8Timestamp(utcMs)
	} else {
		o.Timestamp = time.Now().UTC()
	}
	return o
}

func (obj *InboxMessageObj) Insert(db *sql.DB) error {
	stmt, err := db.Prepare(SQL_INBOX_INSERT)
	if err != nil {
		return fmt.Errorf("error preparing inbox insert: %w", err)
	}
	defer stmt.Close()

	res, err := stmt.Exec(toSqlTime(obj.Timestamp), obj.Callsign, obj.Message, obj.UtcMs)
	if err != nil {
		return fmt.Errorf("error executing inbox insert: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking inbox insert result: %w", err)
	}
	if affected == 0 {
		// INSERT OR IGNORE skipped a duplicate — fetch the existing row's ID for broadcast.
		// (last_insert_rowid() is not reliable here: SQLite leaves it unchanged on a no-op insert.)
		row := db.QueryRow(SQL_INBOX_FIND_BY_KEYS, obj.Callsign, obj.UtcMs, obj.Message)
		_ = row.Scan(&obj.Id)
	} else {
		id, err := res.LastInsertId()
		if err != nil {
			return fmt.Errorf("error reading inbox insert id: %w", err)
		}
		obj.Id = id
	}
	return nil
}

func (obj *InboxMessageObj) Save(db *sql.DB) error { return obj.Insert(db) }

func FetchInboxMessages(db *sql.DB) ([]InboxMessageObj, error) {
	rows, err := db.Query(SQL_INBOX_LIST)
	if err != nil {
		return nil, fmt.Errorf("error querying inbox: %w", err)
	}
	defer rows.Close()

	list := make([]InboxMessageObj, 0)
	for rows.Next() {
		var obj InboxMessageObj
		var ts string
		if err := rows.Scan(&obj.Id, &ts, &obj.Callsign, &obj.Message, &obj.UtcMs); err != nil {
			return nil, err
		}
		obj.Timestamp, _ = fromSqlTime(ts)
		list = append(list, obj)
	}
	return list, rows.Err()
}
