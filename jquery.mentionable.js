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
	var debuggerBlock        = '<div id="mentionable-debugger"></div>'
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

		// Remove other mentionable text area before enabling current one
		if ($('textarea.mentionable-textarea').length) {
			$('textarea.mentionable-textarea').val('');
			$('textarea.mentionable-textarea').off('keypress');
			$('textarea.mentionable-textarea').off('keyup');
		}

		container = textArea.parent();
		targetURL = usersURL;
		options = $.extend({
			'id': 'mentioned-user-list',
			'maxTags': null,
			'minimumChar': 1,
			'parameterName': 'mentioning',
			'position': 'bottom',
			'debugMode': false,
		}, opts);
		userListWrapper = $('<ul id="' + options.id + '"></ul>');

		if (options.debugMode)
			container.before(debuggerBlock);

		if ($(this).val() === '@')
			initNameCaching();
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
					// Firefox hack
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
			debug();
		});
		this.keyup(function(e){
			switch (e.keyCode) {
				// Delete or Backspace key is pressed
				case KEY.DELETE:
				case KEY.BACKSPACE:
					// If deleting back into a mention, reset name caching
					var bDeleteExisting = false;
					$('[name="recipient_ids[]"]').each(function(){
						var iStrposStart = $(this).data('strpos-start');
						var iStrposEnd = $(this).data('strpos-end');
						if (iStrposStart <= currentCaretPosition() && iStrposEnd >= currentCaretPosition()) {
							caretStartPosition = iStrposStart;
							cachedName = textArea.val().substring(iStrposStart, currentCaretPosition());
							fullCachedName = textArea.val().substring(iStrposStart, iStrposEnd);
							bDeleteExisting = true;
							$(this).remove();
							return false;
						}
					});
					// Refresh AJAX request
					if (!bDeleteExisting) {
						cachedName = cachedName.substring(0, cachedName.length -1);
						fullCachedName = cachedName;
					}
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
			debug();
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
	 * Replace @ with empty string, then fire a request for user list.
	 *
	 * @param string keyword
	 */
	function populateItems(keyword){
		if (keyword.length > options.minimumChar && (!options.maxTags || $('[name="recipient_ids[]"]').length < options.maxTags)) {

			if (!isUserFrameShown)
				showUserFrame();

			userList.html('');
			var data = {};
			if (keyword != undefined)
				data[options.parameterName] = keyword.substring(1, keyword.length);
			if ($('[name="recipient_ids[]"]').length) {
				var recipientIds = [];
				$('[name="recipient_ids[]"]').each(function(){
					recipientIds.push($(this).val());
				});
				data.recipient_ids = recipientIds;
			}
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
	 *
	 * @param object data
	 */
	function fillItems(data){
		if (data.length > 0) {
			listSize = data.length;
			$.each(data, function(key, value){
				userList.append('<li data-friend-id="' + value.id + '"><img src="' + value.image_url + '" /><span>' + value.name + '</span></li>');
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
	 *
	 * @param element userItem
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
		textArea.val(replacedText + ' ');
		hideUserFrame();

		// Save the user id
		var iStart = textArea.val().substring(0, currentCaretPosition()).lastIndexOf('@'); // @todo use caretStartPosition from a few lines up?
		var iEnd = iStart + userItem.children('span').text().length;
		var recipientIds = $('<input type="hidden" name="recipient_ids[]" value="' + userItem.data('friend-id')
			+ '" data-strpos-start="' + iStart + '" data-strpos-end="' + iEnd + '">');
		container.append(recipientIds);
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
		if (options.debugMode) {
			$('#mentionable-debugger').html(
				'<b>cache : </b>' + cachedName + ' | <b>full cache : </b>' + fullCachedName
			);
		}
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
	 * @param from An integer of a begining position
	 * @param to An itenger of an ending position
	 * @param originalString An original string to be partialy replaced
	 * @param addedString A string to be replaced
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
