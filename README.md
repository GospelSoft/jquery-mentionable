# jQuery Mentionable
**Enable the user to mention other people by typing "@"**

jQuey Mentionable is a plugin that enables the user to mention other people after
typing "@"" in the textarea, a la Twitter or Instagram.
<!---
@todo
The example of jquery-mentionable can be found
[here](http://jquery-mentionable.ap01.aws.af.cm)
-->

## Requirements
You need to have a URL that, when it is called, returns a list of users in JSON format.
When the user starts typing a name after "@", jquery.mentionable will make an AJAX call to that
URL, and pass the typed name as a query param called `mentioning`. For instance, if the URL
is *http://localhost/users.json*, when the user types '@tai', jquery.mentionable will fire
a request to *http://localhost/users.json?mentioning=tai*. The JSON response should look
like this:
```json
[
    {
        "id":1,
        "name":"taiko",
        "image_url":"/assets/u1.png",
        "created_at":"2012-08-15T16:07:30Z",
        "updated_at":"2012-08-15T16:26:35Z"
    },
    {
        "id":2,
        "name":"Kiera Harber",
        "image_url":"/assets/u2.png",
        "created_at":"2012-08-15T16:15:59Z",
        "updated_at":"2012-08-15T16:15:59Z"
    },
    ...
]
```

jquery.mentionable has a built-in callback that will populate the
user list for you after the AJAX call succeeds. The only thing you
need to do is to ensure that the JSON response is an array of user objects
where each object has an `id`, `name`, and `image_url` field. You can also
supply the callback function yourself if there is more logic
you want to perform.

*NOTE: The `created_at` and `updated_at` properties mentioned above are not currently used.*

## Usage
First, include jQuery and jquery.mentionable in your HTML.
```html
<script src="jquery.js"></script>
<script src="jquery.mentionable.js"></script>
<link href="jquery.mentionable.css" media="all" rel="stylesheet" type="text/css">
```
Next, wrap a textarea with a relatively-positioned div. This ensures the user list
is positioned correctly.
```html
<div style="position:relative;">
  <textarea id="textarea"></textarea>
</div>
```
To make a textarea mentionable, in JavaScript, call the `.mentionable()` method with a URL string as its parameter.
```JavaScript
$('#textarea').mentionable('http://localhost/users.json');
```
The above code will use a default callback to handle populating the user list.

After a mentionee is selected, jquery.mentionable creates a hidden input with the corresponding `id`
(from the JSON response) so you can submit that data with your form:
```html
<input type="hidden" name="mentioned_id[]" value="13">
```

## Configuring

jquery.mentionable accepts 3 parameters:

### strUsersUrl
`strUsersUrl` is, as stated above, a URL for a user JSON collection.

### oOpts
`oOpts` is an options object that accepts the following parameters:
* *id* : The HTML `id` attribute of the user list container.
** Default: `mentioned-user-list`
* *maxTags* : Maximum number of users that can be tagged.
** Default: `null` (unlimited).
* *minimumChar* : The minimum number of characters required to trigger user fetching.
** Default: `1`.
* *parameterName* : The name of the parameter to be passed to the user list url.
** Default: `mentioning`.
* *position* : The position of user list: left, bottom, or right.
** Default: `bottom`.
* *debugMode* : A boolean switch to turn debug mode on/off. Debug mode shows you the `strCachedName` and `strFullCachedName` values in real time just above the textarea.
** Default: `false` (debugging off).

The following example creates a mentionable textarea which will pass a string via 'filter' query parameter when 3 or more characters are typed.
```JavaScript
$("#textarea").mentionable(
  "http://your/user/list/url",
  {minimumChar: 3, parameterName: "filter"}
);
```

### fnOnComplete
`fnOnComplete` is a function that will be triggered when the AJAX call is successful.

For instance, the following code will pop an alert box when the user list is loaded.
```JavaScript
$("#textarea").mentionable("user_list_url", null, function(){
  alert("hello world"); // do what you want here
});
```

## Styling

If you decide to customize the user list id, the base style of jquery-mentionable will not be applied.
Please take a look at jquery-mentionable.css to explore the base style.

## Credits
Forked from a project by [Warut Surapat](https://github.com/swarut)
[https://github.com/oozou/jquery-mentionable]