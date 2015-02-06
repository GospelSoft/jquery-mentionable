/**
 * jQuery Mentionable
 *
 * A jQuery plugin that enables the user to mention other people.
 *
 * MIT Licensed.
 * Forked from https://github.com/oozou/jquery-mentionable
 */
(function( $ ) {
	var bDeleteExisting       = false;
	var bIsUserFrameShown     = false;
	var bMentioningUser       = false;
	var eContainer            = null;
	var eTextArea             = null;
	var eUserList             = null;
	var eUserListWrapper      = $('<ul id="mentioned-user-list"></ul>');
	var fnOnComplete          = null;
	var iCaretStartPosition   = 0;
	var iCaretEndPosition     = 0;
	var iKeyRespondingTimeOut = null;
	var iListSize             = 0;
	var oOptions              = null;
	var strCachedName         = '';
	var strFullCachedName     = '';
	var strInputText          = null;
	var strTargetUrl          = null;

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
	 * param strUsersUrl   A url to fire an ajax call to retrieve user list.
	 * param oOpts         Options:
	 *                         (id) the id of the user list block.
	 *                         (minimumChar) the minimum number of character to trigger user data retrieval
	 *                         (parameterName) the query parameter name
	 *                         (position) the position of the list (right, bottom, left)
	 * param fnOnComplete  A callback function when user list is retrieved. Expected to be a user item generation.
	 *
	 */
	$.fn.mentionable = function(strUsersUrl, oOpts, fnOnComplete){
		eTextArea = this;

		// Remove other mentionable text area before enabling current one
		if ($('textarea.mentionable-textarea').length) {
			$('textarea.mentionable-textarea').val('');
			$('textarea.mentionable-textarea').off('keypress');
			$('textarea.mentionable-textarea').off('keyup');
		}

		eContainer = eTextArea.parent();
		strTargetUrl = strUsersUrl;
		oOptions = $.extend({
			'id': 'mentioned-user-list',
			'maxTags': null,
			'minimumChar': 1,
			'parameterName': 'mentioning',
			'position': 'bottom',
			'debugMode': false,
		}, oOpts);
		eUserListWrapper = $('<ul id="' + oOptions.id + '"></ul>');

		if (oOptions.debugMode)
			eContainer.before('<div id="mentionable-debugger"></div>');

		if ($(this).val() === '@')
			initNameCaching();
		this.keypress(function(e){

			watchKey();

			switch (e.keyCode) {
				case KEY.ATSIGN:
					initNameCaching();
					break;
				case KEY.ENTER:
					if (bMentioningUser) {
						selectUser(eUserList.find('li.active'));
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
						if (strCachedName != '')
							strCachedName += String.fromCharCode(e.charCode);
					}
			}

			// If user typed any letter while the caret is not at the end
			// completely remove the string behind the caret.
			strFullCachedName = strCachedName;
			debug();
		});
		this.keydown(function(e){
			switch (e.keyCode) {
				case KEY.DELETE:
				case KEY.BACKSPACE:
					// If deleting back into a mention, reset name caching
					$('[name="mentioned_id[]"]').each(function(){
						var iStrposStart = parseInt($(this).attr('data-strpos-start')); // using attr() b/c data() is unwritable
						var iStrposEnd = parseInt($(this).attr('data-strpos-end'));
						// Remove the one being deleted
						if (iStrposStart <= currentCaretPosition() && iStrposEnd >= currentCaretPosition()) {
							iCaretStartPosition = iStrposStart;
							iCaretEndPosition = iStrposEnd;
							bDeleteExisting = true;
							$(this).attr('data-strpos-end', iStrposEnd - 1);
							$(this).prop('disabled', true);
						// Adjust start & end for those following
						} else if (iStrposStart > currentCaretPosition()) {
							$(this).attr('data-strpos-start', iStrposStart - 1);
							$(this).attr('data-strpos-end', iStrposEnd - 1);
						}
					});
					break;
			}
		});
		this.keyup(function(e){
			switch (e.keyCode) {
				case KEY.DELETE:
				case KEY.BACKSPACE:
					if (bDeleteExisting) {
						strCachedName = eTextArea.val().substring(iCaretStartPosition, currentCaretPosition());
						strFullCachedName = eTextArea.val().substring(iCaretStartPosition, iCaretEndPosition);
					} else {
						strCachedName = strCachedName.substring(0, strCachedName.length - 1);
						strFullCachedName = strCachedName;
					}
					//bDeleteExisting = false;
					//remove disabled input
					if ('' == strCachedName)
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
		iCaretStartPosition = currentCaretPosition();
		strCachedName = '@';
	}

	/**
	 * Hide the user list frame, and clear some related stuffs.
	 */
	function hideUserFrame(){
		strCachedName = '';
		strFullCachedName = '';
		iListSize = 0;
		bMentioningUser = false;
		if (bIsUserFrameShown) {
			eUserList.remove();
			bIsUserFrameShown = false;
		}
	}

	/**
	 * Show the user list frame.
	 */
	function showUserFrame(){
		eContainer.append(eUserListWrapper);
		bMentioningUser = true;

		eUserList = $('#' + oOptions.id);
		if (oOptions.position == 'left') {
			eUserList.css('left', -1 * eUserList.outerWidth());
			eUserList.css('top', 0);
		} else if (oOptions.position == 'right') {
			eUserList.css('left', eTextArea.outerWidth());
			eUserList.css('top', 0);
		} else if (oOptions.position == 'bottom') {
			eUserList.css('left', 0);
			eUserList.css('top', eTextArea.outerHeight());
			eUserList.css('width', eTextArea.outerWidth());
		}

		eUserList.show();
		bIsUserFrameShown = true;
	}

	/**
	 * Replace @ with empty string, then fire a request for user list.
	 *
	 * @param string strKeyword
	 */
	function populateItems(strKeyword){
		if (strKeyword.length > oOptions.minimumChar && (!oOptions.maxTags || $('[name="mentioned_id[]"]').length < oOptions.maxTags)) {

			if (!bIsUserFrameShown)
				showUserFrame();

			eUserList.html('');
			var oData = {};
			if (strKeyword != undefined)
				oData[oOptions.parameterName] = strKeyword.substring(1, strKeyword.length);
			if ($('[name="mentioned_id[]"]').length) {
				var aRecipientIds = [];
				$('[name="mentioned_id[]"]').each(function(){
					if (!$(this).prop('disabled'))
						aRecipientIds.push($(this).val());
				});
				oData.mentioned_id = aRecipientIds;
			}
			if (fnOnComplete == undefined)
				fnOnComplete = function(oData){ fillItems(oData); }
			$.getJSON(strTargetUrl, oData, fnOnComplete);
			bindItemClicked();
		}
	}

	/**
	 * Fill user name and image as a list item in user list block.
	 *
	 * @param object oData
	 */
	function fillItems(oData){
		if (oData.length > 0) {
			iListSize = oData.length;
			$.each(oData, function(iKey, oValue){
				eUserList.append('<li data-friend-id="' + oValue.id
					+ '"><img src="' + oValue.image_url + '"><span>'
					+ oValue.name + '</span></li>');
			});
			eUserList.find('li:first-child').attr('class', 'active');
			bindItemClicked();
		} else {
			eUserList.append('<li>No user found</li>');
		}
	}

	/**
	 * Bind item clicked to all item in user list.
	 */
	function bindItemClicked(){
		// Handle when user item is clicked
		var eUserListItems = eUserList.find('li');
		eUserListItems.click(function(){
			selectUser($(this));
		});
	}

	/**
	 * Perform a user selection by adding the selected user name
	 * to the text area.
	 *
	 * @param element eUserItem
	 */
	function selectUser(eUserItem){
		var strUserName = eUserItem.find('span').text();
		strInputText = eTextArea.val();
		strReplacedText = replaceString(
			iCaretStartPosition,
			iCaretStartPosition + strFullCachedName.length,
			strInputText,
			'@' + strUserName
		);
		eTextArea.focus();
		eTextArea.val(strReplacedText.trim() + ' ');

		// Update position of following mentions
		$('[name="mentioned_id[]"]').each(function(){
			var iStrposStart = parseInt($(this).attr('data-strpos-start')); // using attr() b/c data() is unwritable
			var iStrposEnd = parseInt($(this).attr('data-strpos-end'));
			if (iStrposStart > iCaretStartPosition + strFullCachedName.length) {
				var iDiff = strUserName.length + 1 - strFullCachedName.length; // "+ 1" accounts for @ symbol
				$(this).attr('data-strpos-start', iStrposStart + iDiff);
				$(this).attr('data-strpos-end', iStrposEnd + iDiff);
			}
		});

		// Save the user id
		$('[name="mentioned_id[]"][value="' + eUserItem.data('friend-id') + '"]').remove();
		var eRecipientIds = $('<input type="hidden" name="mentioned_id[]" value="' + eUserItem.data('friend-id')
			+ '" data-strpos-start="' + iCaretStartPosition + '" data-strpos-end="' + (iCaretStartPosition + strUserName.length) + '">');
		eContainer.append(eRecipientIds);

		hideUserFrame();
	}

	function caretMoveLeft(){
		if (bMentioningUser) {
			// Remove last char from strCachedName while maintaining the strFullCachedName
			if (strCachedName != '@')
				strCachedName = strFullCachedName.substring(0, strCachedName.length - 1);
			else
				hideUserFrame();
		}
	}

	function caretMoveRight(){
		if (bMentioningUser) {
			if (strCachedName == strFullCachedName) {
				hideUserFrame();
			} else {
				// Append to the tail the next character retrieved from strFullCachedName
				strCachedName = strFullCachedName.substring(0, strCachedName.length + 1);
			}
		}
	}

	function caretMoveUp(){
		eCurrentUserItem = eUserList.find('li.active');
		if (eCurrentUserItem.index() != 0) {
			ePreviousUserItem = eCurrentUserItem.prev();
			eCurrentUserItem.attr('class', '');
			ePreviousUserItem.attr('class', 'active');
			eUserList.scrollTop(ePreviousUserItem.index() * ePreviousUserItem.outerHeight());
		}
	}

	function caretMoveDown(){
		eCurrentUserItem = eUserList.find('li.active');
		if (eCurrentUserItem.index() != iListSize - 1) {
			eNextUserItem = eCurrentUserItem.next();
			eCurrentUserItem.attr('class', '');
			eNextUserItem.attr('class', 'active');
			eUserList.scrollTop(eNextUserItem.index() * eNextUserItem.outerHeight());
		}
	}

	function debug(){
		if (oOptions.debugMode) {
			$('#mentionable-debugger').html(
				'<b>cache :</b> ' + strCachedName + ' | <b>full cache :</b> ' + strFullCachedName
			);
		}
	}

	/**
	 * Return an integer of a curret caret position.
	 */
	function currentCaretPosition(){
		return eTextArea[0].selectionStart;
	}

	/**
	 * Replace a part of strOriginal from [iFrom] to [iTo] position with strAdded.
	 *
	 * @param iFrom An integer of a begining position
	 * @param iTo An itenger of an ending position
	 * @param strOriginal An original string to be partialy replaced
	 * @param strAdded A string to be replaced
	 */
	function replaceString(iFrom, iTo, strOriginal, strAdded){
		try {
			if (0 == iFrom) {
				return strAdded + strOriginal.substring(iTo, strOriginal.length);
			} else {
				strFirstChunk = strOriginal.substring(0, iFrom);
				strLastChunk = strOriginal.substring(iTo, strOriginal.length);
				return strFirstChunk + strAdded + strLastChunk;
			}
		} catch (error) {
			return strOriginal;
		}
	}

	/**
	 * Initialize the key timeout. It will observe the user interaction.
	 * If the user did not respond within a specific time, e.g. pausing typing,
	 * it will fire poplateItems()
	 */
	function watchKey(){
		clearTimeout(iKeyRespondingTimeOut);
		iKeyRespondingTimeOut = setTimeout(
			function(){
				populateItems(strCachedName);
			},
			500
		);
	}

	/**
	 * Return a jQuery object of the user list item that is in an active state.
	 */
	function activeUserItemIndex(){
		return eUserList.find('li.active').index();
	}

})( jQuery );
