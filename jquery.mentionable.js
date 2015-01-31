/**
 * jQuery Mentionable
 *
 * A jQuery plugin that enables the user to mention other people.
 *
 * MIT Licensed.
 * Forked from https://github.com/oozou/jquery-mentionable
 */
(function( $ ) {
	var cachedName           = '';
	var fullCachedName       = '';
	var mentioningUser       = false;
	var textArea             = null;
	var container            = null;
	var userListWrapper      = $('<ul id="mentioned-user-list"></ul>');
	var userList             = null;
	var inputText            = null;
	var targetURL            = null;
	var onComplete           = null;
	var options              = null;
	var debugMode            = false;
	var debuggerBlock        = '<div id="mentionable-debugger"></div'
	var caretStartPosition   = 0;
	var keyRespondingTimeOut = null;
	var keyRespondTime       = 500;
	var listSize             = 0;
	var isUserFrameShown     = false;

	var KEY = {
		BACKSPACE:    8,
		DELETE:       46,
		TAB:          9,
		ENTER:        13,
		ESCAPE:       27,
		SPACE:        32,
		PAGE_UP:      33,
		PAGE_DOWN:    34,
		END:          35,
		HOME:         36,
		LEFT:         37,
		UP:           38,
		RIGHT:        39,
		DOWN:         40,
		NUMPAD_ENTER: 108,
		COMMA:        188,
		ATSIGN:       64
	};

	/**
	 * Make a textarea support user mentioning.
	 *
	 * param usersURL             A url to fire an ajax call to retrieve user list.
	 * param opts                 Options:
	 *                              (id) the id of the user list block.
	 *                              (minimumChar) the minimum number of character to trigger user data retrieval
	 *                              (parameterName) the query parameter name
	 *                              (position) the position of the list (right, bottom, left)
	 * param onCompleteFunction   A callback function when user list is retrieved. Expected to be a user item generation.
	 *
	 */
	$.fn.mentionable = function(usersURL, opts, onCompleteFunction){
		textArea = this;

		// remove other mentionable text area before enable current one
		if ($('textarea.mentionable-textarea').length) {
			$('textarea.mentionable-textarea').val('');
			$('textarea.mentionable-textarea').off('keypress');
			$('textarea.mentionable-textarea').off('keyup');
		}

		container = textArea.parent();
		targetURL = usersURL;
		options = $.extend({
			'id' : 'mentioned-user-list',
			'minimumChar' : 2,
			'parameterName' : 'mentioning',
			'position' : 'bottom'
		}, opts);
		userListWrapper = $('<ul id="' + options.id + '"></ul>');

		if (debugMode)
			container.before(debuggerBlock);

		this.keypress(function(e){

			watchKey();

			switch (e.keyCode) {
				case KEY.ATSIGN:
					initNameCaching();
					break;
				case KEY.ENTER:
					if (mentioningUser) {
						selectUser(userList.find('li.active'));
						e.preventDefault();
					}
					hideUserFrame();
					break;
				case KEY.SPACE:
					hideUserFrame();
					break;
				default:
					// Firefox hacked!
					// There is a problem on FF that @'s keycode returns 0.
					// The case KEY.ATSIGN fails to catch, so we need to do it here instead
					if (String.fromCharCode(e.charCode) == '@') {
						initNameCaching();
					} else {
						// append pressed character to cache
						if (cachedName != '')
							cachedName += String.fromCharCode(e.charCode);
					}
			}

			// If user typed any letter while the caret is not at the end
			// completely remove the string behind the caret.
			fullCachedName = cachedName;
		});
		this.keyup(function(e){
			switch (e.keyCode) {
				case KEY.DELETE:
				case KEY.BACKSPACE:
					// delete or backspace key is pressed
					cachedName = cachedName.substring(0, cachedName.length -1);
					fullCachedName = cachedName;
					if (cachedName == '')
						hideUserFrame();
					else
						watchKey();
					break;
				case KEY.ESCAPE:
					hideUserFrame();
					break;
				case KEY.LEFT:
					watchKey();
					caretMoveLeft();
					break;
				case KEY.UP:
					caretMoveUp();
					break;
				case KEY.RIGHT:
					watchKey();
					caretMoveRight();
					break;
				case KEY.DOWN:
					caretMoveDown();
					break;
			}
		});
	};

	/**
	 * Initialize a cache that store the user name that is being mentioned.
	 */
	function initNameCaching(){
		caretStartPosition = currentCaretPosition();
		cachedName = '@';
	}

	/**
	 * Hide the user list frame, and clear some related stuffs.
	 */
	function hideUserFrame(){
		cachedName = '';
		fullCachedName = '';
		listSize = 0;
		mentioningUser = false;
		if (isUserFrameShown) {
			userList.remove();
			isUserFrameShown = false;
		}
	}

	/**
	 * Show the user list frame.
	 */
	function showUserFrame(){
		container.append(userListWrapper);
		mentioningUser = true;

		userList = $('#' + options.id);
		if (options.position == 'left') {
			userList.css('left', -1 * userList.outerWidth());
			userList.css('top', 0);
		} else if (options.position == 'right') {
			userList.css('left', textArea.outerWidth());
			userList.css('top', 0);
		} else if (options.position == 'bottom') {
			userList.css('left', 0);
			userList.css('top', textArea.outerHeight());
			userList.css('width', textArea.outerWidth());
		}

		userList.show();
		isUserFrameShown = true;
	}

	/**
	 * Replace @ with empyty string, then fire a request for user list.
	 */
	function populateItems(keyword){
		if (keyword.length > options.minimumChar) {

			if (!isUserFrameShown)
				showUserFrame();

			userList.html('');
			var data = {};
			if (keyword != undefined)
				data[options.parameterName] = keyword.substring(1, keyword.length);
			if (onComplete != undefined) {
				$.getJSON(targetURL, data, onComplete);
			} else {
				$.getJSON(targetURL, data, function(data){
					fillItems(data);
				});
			}
			bindItemClicked();
		}
	}

	/**
	 * Fill user name and image as a list item in user list block.
	 */
	function fillItems(data){
		if (data.length > 0) {
			listSize = data.length;
			$.each(data, function(key, value){
				userList.append('<li><img src="' + value.image_url + '" /><span>' + value.name + '</span></li>');
			});
			userList.find('li:first-child').attr('class', 'active');
			bindItemClicked();
		} else {
			userList.append('<li>No user found</li>');
		}
	}

	/**
	 * Bind item clicked to all item in user list.
	 */
	function bindItemClicked(){
		// Handle when user item is clicked
		var userListItems = userList.find('li');
		userListItems.click(function(){
			selectUser($(this));
		});
	}

	/**
	 * Perform a user selection by adding the selected user name
	 * to the text area.
	 */
	function selectUser(userItem){
		inputText = textArea.val();
		replacedText = replaceString(
			caretStartPosition,
			caretStartPosition + fullCachedName.length,
			inputText,
			'@' + userItem.find('span').html()
		);
		textArea.focus();
		textArea.val(replacedText);
		hideUserFrame();
	}

	function caretMoveLeft(){
		if (mentioningUser) {
			// Remove last char from cachedName while maintaining the fullCachedName
			if (cachedName != '@')
				cachedName = fullCachedName.substring(0, cachedName.length - 1);
			else
				hideUserFrame();
		}
	}

	function caretMoveRight(){
		if (mentioningUser) {
			if (cachedName == fullCachedName) {
				hideUserFrame();
			} else {
				// Append to the tail the next character retrieved from fullCachedName
				cachedName = fullCachedName.substring(0, cachedName.length + 1);
			}
		}
	}

	function caretMoveUp(){
		currentUserItem = userList.find('li.active');
		if (currentUserItem.index() != 0) {
			previousUserItem = currentUserItem.prev();
			currentUserItem.attr('class', '');
			previousUserItem.attr('class', 'active');
			userList.scrollTop(previousUserItem.index() * previousUserItem.outerHeight());
		}
	}

	function caretMoveDown(){
		currentUserItem = userList.find('li.active');
		if (currentUserItem.index() != listSize-1) {
			nextUserItem = currentUserItem.next();
			currentUserItem.attr('class', '');
			nextUserItem.attr('class', 'active');
			userList.scrollTop(nextUserItem.index() * nextUserItem.outerHeight());
		}
	}

	function debug(){
		myDebugger = $('#mentionable-debugger');
		myDebugger.html('<b>cache : </b>' + cachedName + ' | <b>full cache : </b>' + fullCachedName);
	}

	/**
	 * Return an integer of a curret caret position.
	 */
	function currentCaretPosition(){
		caretContainer = textArea[0];
		return caretContainer.selectionStart;
	}

	/**
	 * Replace a part of originalString from [from] to [to] position with addedString.
	 *
	 * param from               An integer of a begining position
	 * param to                 An itenger of an ending position
	 * param originalString     An original string to be partialy replaced
	 * param addedString        A string to be replaced
	 */
	function replaceString(from, to, originalString, addedString){
		try {
			if (from == 0)
				return addedString + originalString.substring(to, originalString.length);
			if (from != 0) {
				firstChunk = originalString.substring(0, from);
				lastChunk = originalString.substring(to, originalString.length);
				return firstChunk + addedString + lastChunk;
			}
		} catch (error) {
			return originalString;
		}
	}

	/**
	 * Initialize the key timeout. It will observe the user interaction.
	 * If the user did not respond within a specific time, e.g. pausing typing,
	 * it will fire poplateItems()
	 */
	function watchKey(){
		clearTimeout(keyRespondingTimeOut);
		keyRespondingTimeOut = setTimeout(
			function(){
				populateItems(cachedName);
			},
			keyRespondTime
		);
	}

	/**
	 * Return a jQuery object of the user list item that is in an active state.
	 */
	function activeUserItemIndex(){
		return userList.find('li.active').index();
	}

})( jQuery );
