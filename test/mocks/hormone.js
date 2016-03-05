"use strict";

class Hormone {

	constructor( isFresh, error ) {
		this._isFresh = isFresh;
		this._error = error;
	}

	get isFresh() {
		return this._isFresh;
	}

	get error() {
		return this._error;
	}

}

module.exports = Hormone;
