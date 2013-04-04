// TO DO LIST
//  log in on facebook **

//  caching friend list, progressive/iterative loading
//  re-sort only on change sort order, insert cleverly
//  results count in header selectors
//  age / birth month
//  more sort-by's
//  religion/etc
(function() {

DEBUG = 0;

// loaded: true/false
// access_token: string
FACEBOOK = {

  access_token: null,
  app_id: '100230736775841',
  landing_url: 'http://fbsearch.kaistinchcombe.com/',
  request_permissions: function() {
    if (DEBUG) {
      window.open("https://developers.facebook.com/tools/explorer/"+FACEBOOK.app_id+"/?method=GET&path=204987");
      window.setTimeout(function() {
        if (FACEBOOK.access_token = prompt("Please enter your access token:",""))
        {
          localStorage.setItem('advanced_search#access_token', FACEBOOK.access_token);
          APPLICATION.load(0);
        }
      },3000);
      return;
    }
    FACEBOOK.url = 'https://www.facebook.com/dialog/oauth?client_id='+FACEBOOK.app_id+'&scope='+APPLICATION.permissions_required.join(',')+'&response_type=token&redirect_uri='+FACEBOOK.landing_url ;
    window.location.href = FACEBOOK.url;
  },
  parse_token: function() {
    APPLICATION.status('Connecting to facebook...')

    // load the access token from the url
    if (access_match = window.location.href.match(/access_token=([^&]*)/))
    {
      // save and store it
      FACEBOOK.access_token = access_match[1];
      localStorage.setItem('advanced_search#access_token', FACEBOOK.access_token);
    }
    // load the access token from localStorage
    else if (window.localStorage && localStorage.getItem) {
      FACEBOOK.access_token = localStorage.getItem('advanced_search#access_token');
    }
    
    // if we don't have it, request it
    if (!FACEBOOK.access_token)
    {
      FACEBOOK.request_permissions();
      return false;
    }
    // otherwise return we have it
    else
      return true;
  }
}; //end FACEBOOK object

APPLICATION = (function(){ var self = {
  
  /////////////////////////////////////////////////////
  // INDICES

  // this is as { id: friend, id: friend, ... }
  friends: {},
  //this is as { field: { value: {id: friend, id: friend}, value: {id: friend}, ...} }
  // i.e. use self.friends_index['work']['Facebook'] and you'll get { id: friend, id: friend }
  friends_index: {},
  friends_count: 0,
  sorted_friends: [],
  friends_were_loaded_from_cache: false,
  loading_iterator: 0,

  /////////////////////////////////////////////////////
  // FIELD LISTS - GENERAL APP CONFIG

  // fields we get from the API
  indexed_fields: [ 'location', 'work', 'hometown', 'education', 'gender', 'religion', 'political', 'relationship_status' ],
  sortable_fields: [ 'first_name', 'last_name' ],
  other_fields: [ 'picture', 'id', 'name', 'link', 'birthday' ],
  // fields we add ourselves
  extra_indexed_fields: [ 'current_state_or_region', 'home_state_or_region', 'job_title' ],
  extra_sortable_fields: [], //[ 'age', 'birth_month' ], //@todo
  // how we render the user
  displayed_fields: [ 'location', 'work', 'education' ],
  // permissions we get
  permissions_required: [ 'friends_education_history', 'friends_work_history', 'friends_hometown', 'friends_location', 'friends_religion_politics', 'friends_relationships', 'friends_birthday' ],
  // pretty names for fields
  // these really aren't that necessary it turns out
  pretty_names: {},
  //default-visible fields
  selectors_default_visible: [ 'current_state_or_region', 'location', 'work', 'job_title', 'education' ],
  //default-invisible fields
  selectors_default_invisible: [ 'hometown', 'home_state_or_region', 'gender', 'religion', 'political', 'relationship_status' ],
  
  
  /////////////////////////////////////////////////////
  // CURRENT SEARCH STATUS

  //current search status
  // as {field: {value=>1, value2=>1}, field2: {value=>1}}
  current_search_params: {},
  //current search results
  current_results: {},
  current_sort_by: 'last_name',
  current_sort_is_descending: false,
  current_results_sorted: [],
  current_results_count: 0,
  
  /////////////////////////////////////////////////////
  // SETUP

  init: function() {
  },
  //called when the loading of friends over the wire is done

  //if it's our first load, call it as load(0);
  load: function(response) {

    //@todo verify we have a facebook access key
    // FACEBOOK.request_permissions();
    var ajax_error = function(jqXHR, textStatus, errorThrown) {
      // console.log([jqXHR, textStatus, errorThrown]);
      FACEBOOK.request_permissions();
    };

    if (response===0) {
      
      APPLICATION.status('Loading your friends...')
      var params = {
          fields: $.merge_all([[], self.indexed_fields, self.sortable_fields, self.other_fields]).join(','),
          limit: DEBUG ? 100 : (response == 0 ? 250 : 500),
          access_token: FACEBOOK.access_token
        };
      $.ajax({
        url: 'https://graph.facebook.com/me/friends',
        data: params,
        dataType: 'json',
        success: self.load,
        error: ajax_error
      });
      return;
    } //end if first load
    
    self.loading_iterator ++;
    if (self.loading_iterator == 1)
    {
      var friends_json;
      if (window.localStorage && (friends_json = localStorage.getItem('advanced_search#friends'))) {
        APPLICATION.status('Displaying your friends...')
        self.friends_were_loaded_from_cache = true;
        self.friends = JSON.parse(friends_json);
        var new_friends = [];
        $.each(self.friends, function(idx, friend) { new_friends.push(friend) });
        self.friends_count = new_friends.length;
        self.index_friends(new_friends);
        self.merge_friends(new_friends);
        APPLICATION.status('Loaded '+self.friends_count+' friends.')
        self.render_selectors();
      }
    }
        
    var has_next_page = (response.paging && response.paging.next && !DEBUG);

    //if there's pagination, load the next page
    if (has_next_page) {
      if (!self.friends_were_loaded_from_cache) APPLICATION.status('Loaded '+self.friends_count+' friends...')
      $.ajax({
        url: response.paging.next,
        dataType: 'json',
        success: self.load,
        error: ajax_error
      });
    }
    
    // add our results to the current data
    if (response.data) {
      var new_friends = [];
      self.friends_count += response.data.length;
      $.each(response.data, function(idx, friend) {
        //transform the friend
        self.friends[friend.id] = self.transform_friend(friend);
        new_friends.push(self.friends[friend.id]);
      });
      // add our results to the current data
      self.index_friends(new_friends);
      //@todo execute search on these friends?
      self.merge_friends(new_friends);
    }
    
    // if no pagination, we're done
    if (!has_next_page) {
      localStorage.setItem('advanced_search#friends', JSON.stringify(self.friends));
      if (!self.friends_were_loaded_from_cache) {
        APPLICATION.status('Loaded '+self.friends_count+' friends.')
        self.render_selectors();
      }
    }
  },
  // we pass each friend object through this function, which should set each of our 'extra' fields
  // and transforms each indexed property to an array
  // we do this during indexing rather than during loading...
  // it is required 
  transform_friend: function(friend) {
    // we need to convert to simple arrays for the values provided of
    //  'education', 'location', 'work'
    // and we need to define
    //  extra_indexed_fields: [ 'job_title' ],
    //  extra_sortable_fields: [ 'age', 'birth_month' ] //@todo
    // and then incidentally, work is reverse-chronological (what we want) and education is chronological (must be reversed)
    var geo_parts;
    if (friend.location) {
      friend.location = friend.location.name;
      if (friend.location && (geo_parts = friend.location.match(/(.*), (.*)/))) {
        friend.current_state_or_region = geo_parts[2];
        if (UTIL.state_abbrs[friend.current_state_or_region])
        friend.location = geo_parts[1] + ', ' + UTIL.state_abbrs[friend.current_state_or_region];
      }
    }
    if (friend.hometown && friend.hometown.name) {
      friend.hometown = friend.hometown.name;
      if (friend.hometown && (geo_parts = friend.hometown.match(/(.*), (.*)/))) {
        friend.home_state_or_region = geo_parts[2];
        if (UTIL.state_abbrs[friend.home_state_or_region])
        friend.hometown = geo_parts[1] + ', ' + UTIL.state_abbrs[friend.home_state_or_region];
      }
    }
    if (friend.work) {
      friend.job_title = [];
      $.each(friend.work, function(idx, work_elem) {
        if (work_elem.employer && work_elem.employer.name) friend.work[idx] = work_elem.employer.name;
        if (work_elem.position && work_elem.position.name) friend.job_title[idx] = work_elem.position.name;
      });
    };
    if (friend.education) {
      $.each(friend.education, function(idx, education_elem) {
        if (education_elem.school && education_elem.school.name) friend.education[idx] = education_elem.school.name;
      })
      friend.education = friend.education.reverse();
    };
    return friend;
  },

  //takes self.friends and uses it to populate self.friends_index
  // this is implemented as a triple-loop:
  // for each friend; for each indexed field; for each value of the field
  index_friends: function(friends) {
    
    //get the list of fields
    var indexed_fields = $.merge_all([[], self.indexed_fields, self.extra_indexed_fields]);
    //set each field's index to an empty object
    $.each(indexed_fields, function(idx, field_name) {
      self.friends_index[field_name] = self.friends_index[field_name] || {};
    });
    
    //loop through each friend
    var index_object;

    //add friends to the index
    $.each(friends, function(ignored, friend) {
      friend_id = friend.id;
      //index on each indexed field
      $.each(indexed_fields, function(idx, field_name) {
        var field_values = friend[field_name] || ''
        //make an array of it so we can iterate
        field_values = (typeof(field_values) == 'object') ? field_values : [field_values];
        //iterate through the array values to build out our index
        $.each(field_values, function(idx, field_value) {
          //fill in an empty object for the value if it's not defined
          if (!self.friends_index[field_name][field_value]) self.friends_index[field_name][field_value] = {};
          //add this friend to the index element
          self.friends_index[field_name][field_value][friend_id] = friend;

        }); //end field values loop
      }); //end indexed fields loop
    }); //end friends loop
  },  //end index_friends function
  
  /////////////////////////////////////////////////////
  // SELECTORS

  //as { field: widget, ... }
  selector_index: {},
  
  /////////////////////////////////////////////////////
  // EXECUTE SEARCH

  // this modifies current_search_params
  // omit value to clear all values for that field
  // omit field to clear all search filters
  remove_search_filter: function(field, value) {
    if (!self.current_search_params[field]) return; //no effect -- it's already cleared
    if (!value) delete self.current_search_params[field]; //clear the whole selector
    else delete self.current_search_params[field][value];  //clear that value out of the selector
  },
  // this modifies current_search_params by adding the field
  add_search_filter: function(field, value) {
    if (!self.current_search_params[field]) self.current_search_params[field] = {};
    self.current_search_params[field][value] = 1;
  },
  do_search: function() {
    APPLICATION.status('Searching '+self.friends_count+' friends...')
    APPLICATION.execute_search();
    // APPLICATION.sort_results();
    APPLICATION.show_results();
  },
  pretty_search_terms: function() {
    
  },
  // this takes current_search_params
  // and defines current_results
  execute_search: function() {
    var results = [];
    $.each(self.current_search_params, function (field, values) {
      //skip empty filters
      if (Object.count(values) == 0) {
        delete self.current_search_params[field];
        return;
      }
      //for each one that's real, merge together the items in the index
      // to OR the friends that match
      var results_this_field = {}
      $.each(values, function (value, ignored){
        results_this_field = $.extend(results_this_field, self.friends_index[field][value]);
      })
      results.push(results_this_field);
    });
    if (results.length == 0) {  //no search terms -- everything matches
      self.current_results_count = self.friends_count;
      self.current_results = self.friends;
      APPLICATION.status('You have '+self.current_results_count+' friends.')
      return;
    }
    //now we've filtered by each search term. next is to AND them all
    results.sort(function(a,b){Object.count(a) - Object.count(b)}); //put the smallest one first

    self.current_results_count = 0;
    self.current_results = {};

    var included;
    $.each(results[0], function(friend_id, ignored) {
      included = true;
      $.each(results, function(idx2, results_elem) {
        if (!results_elem[friend_id]) included = false;
      });
      if (included) {
        self.current_results[friend_id] = self.friends[friend_id];
        self.current_results_count ++;
      }
    });
    APPLICATION.status('You have '+self.current_results_count+' matching friends.')
  },
  merge_friends: function(new_friends)
  {
    // add our new list to the array of friends
    self.sorted_friends = self.sorted_friends.concat(new_friends || []);
    self.sorted_friends = self.sort(self.sorted_friends);
    
    var rendered_friends_pos = 0;
    var rendered_friends = $('.friend');
    var previous_rendered_friend = null;

    //go through the list and insert the missing ones
    //@todo this should be done in reverse
    var have_to_re_sort = false;
    $.each(self.sorted_friends, function(idx, friend) {
      if (have_to_re_sort) return;

      //if the next rendered friend is this one, we're great, do nothing and advance
      if (friend.id == parseInt($(rendered_friends[rendered_friends_pos]).attr('friend_id'))) {
        previous_rendered_friend = $(rendered_friends[rendered_friends_pos]);
        rendered_friends_pos++;
        return;
      }
      //else, if that's already rendered, blow it all up. we need to re-sort
      var friend_elem;
      if ((friend_elem = $('#friend__'+friend.id)).length)
        return have_to_re_sort = true;

      //else, render and insert
      friend_elem = self.render_friend(friend);
      if (previous_rendered_friend) friend_elem.insertAfter(previous_rendered_friend);
      else friend_elem.appendTo('#friends')
      previous_rendered_friend = friend_elem;
      
      
    });

    if (have_to_re_sort)
      self.re_sort(true);    
  },
  re_sort: function (array_is_already_sorted)
  {
    //hide, sort, reorder, display
    if (!array_is_already_sorted)
      self.sorted_friends = self.sort(self.sorted_friends);

    var friends_holder = $('#friends');
    friends_holder.hide();
    var rendered_friend;
    $.each(self.sorted_friends, function(idx, friend) {
      rendered_friend = $('#friend__'+friend.id);
      if ( rendered_friend.length )
        rendered_friend.appendTo(friends_holder);
      else
        self.render_friend(friend).appendTo(friends_holder);
        
    });
    friends_holder.show();
    
  },
  // this takes current_results and current_sort_by / current_sort_is_descending
  // and defines current_results_sorted
  sort: function(obj, assume_unique) {
    
    //if not an array, build it an as an array
    if (!obj[0]) {
      //push to an array
      var as_arr = [];
      $.each(obj, function(idx, elem) {
        as_arr.push(elem);
      });
      obj = as_arr;
    }
    
    //sort the results -- in SQL terms, (sort_by == unknown), sort_by, id
    var s; var A; var B;
    obj.sort(function(a,b) {

      A = a[self.current_sort_by];
      B = b[self.current_sort_by];
      //if both unknown sort by id
      if ((!A || A=='') && (!B || B=='')) {
        s = (a.id > b.id);
      }
      // if only one unknown, put it at the bottom
      else if (!A || A=='') return 1;
      else if (!B || B=='') return -1;
      //if both are not unknown, compare using string or numeric comparison
      else if (A == B) {
        s = (a.id > b.id);
      }
      else {
        s = (A > B);
      }
      return (self.current_sort_is_descending ? !s : s) ? 1 : -1;
    });
    
    //uniquify them
    if (assume_unique) return obj;
    var uniq = [];
    $.each(obj, function(idx, elem) {
      //we grab the last by order, so if we have updated the user we'll save that version
      if (idx==(obj.length -1) || obj[idx+1].id != obj[idx].id)
        uniq.push(elem);
    });
    return uniq;
  },
  
  /////////////////////////////////////////////////////
  // HTML RENDERING

  //html rendering -- returns a jquery html element
  render_friend: function(friend) {
    var elem = $('<div class="friend" id="friend__'+friend.id+'" friend_id="'+friend.id+'"/>');
    //photo
    var default_picture = 'http://www.facebook.com/fbprivacy';  //lock icon, white background
    //'http://www.facebook.com/images/registration_graphic.png';  //two blank people on blue background
    elem.append('<a class="friend_picture" href="'+friend.link+'"><img title="'+friend.name+'" src="'+(friend.picture && friend.picture.data && friend.picture.data.url || friend.picture || default_picture)+'"/></a>');
    //info
    html = '<div class="friend_info">';
    html += '<a class="friend_name" href="'+friend.link+'">'+friend.name+'</a>';
    $.each(self.displayed_fields, function(idx, field_name) {
      if (!friend[field_name]) return;
      html += '<br/>' + self.humanize_name(field_name) + ': ';
      var field_contents = typeof(friend[field_name]) == 'object' ? friend[field_name] : [friend[field_name]];
      html += field_contents.join(', ');
    })
    html += '</div>';
    elem.append(html);
    return elem;
  },
  //selectors -- returns nothing
  //***
  // indexed_fields: [ 'gender', 'relationship_status', 'religion', 'political', 'education', 'location', 'work', 'hometown' ],
  // sortable_fields: [ 'first_name', 'last_name' ],
  // other_fields: [ 'picture', 'id', 'name', 'link', 'birthday' ],
  // // fields we add ourselves
  // extra_indexed_fields: [ 'job_title', 'current_state_or_region', 'home_state_or_region' ],
  // extra_sortable_fields: [ 'age', 'birth_month' ],
  render_selectors: function() {

    var indexed_fields = $.merge_all([[], self.selectors_default_visible, self.selectors_default_invisible]);
    var toggle_index = {};
    var selector_toggles = $('.selector_toggles');
    selector_toggles.text('Filter by: ')

    //loop through each index
    $.each(indexed_fields, function(idx, field_name) {
      var elem = $('<div/>').friend_filter_widget({field_name: field_name});
      self.selector_index[field_name] = elem;
      $('#selectors').append(elem);
      //add the show-hide toggle
      var toggle = $('<span/>').addClass('selector_toggle').text(self.humanize_name(field_name));
      toggle_index[field_name] = toggle;
      toggle.click(function() {
        //hide the selector
        toggle.toggleClass('on');
        elem.toggle();
        //clear the search params if we have them
        if (!toggle.hasClass('on')) {
          $('.field_filter_clear', elem).click();
        }
      })
      toggle.appendTo(selector_toggles);
    });
    //show the default-shown ones by clicking the toggle
    $.each(self.selectors_default_visible, function(idx, field_name) {
      toggle_index[field_name].click();
    });
    
  },
  //show results
  // takes current_results_sorted and puts it into our results section
  // manages hiding/showing/etc.
  show_results: function() {
    //$('.friend').hide();
    var friend_id;
    $('#friends').hide();
    $('.friend').reverse().each(function(idx, elem) {
      elem = $(elem);
      friend_id = parseInt(elem.attr('friend_id'));
      var should_be_showing = self.current_results[friend_id];
      elem[should_be_showing ? 'show' : 'hide'](); //elem.toggle(should_be_showing); //seems to be slower
    });
    $('#friends').show();
  },
  
  /////////////////////////////////////////////////////
  // UTIL
  
  humanize_name: function(field_name) {
    if (self.pretty_names[field_name]) return self.pretty_names[field_name];
    return field_name.replace(/_/g,' ').capitalize();
  },
  status: function(str) {
    $('#statusbar .status').text(str || '');
  }

}; return self; })();
window.self = APPLICATION;

//clever geotargeting support

//clever search-element widget

var FriendFilterWidget = (function() { var self = {
  _init: function() {
    var self = this;
    var elem = self.element;
    var field_name = self.options.field_name;
    var index = APPLICATION.friends_index[field_name] || {};
    
    //set up our html

    //overall html
    elem.addClass('field_filter_container');
    elem.html('<div class="field_filter_title"/><select class="field_filter_select"/><input type="button" class="field_filter_clear" value="Clear"/><div class="field_filter_current_values"/>');
    //title
    var title = APPLICATION.humanize_name(field_name);
    $('.field_filter_title', elem).text(title);
    //dropdown
    var null_key = '____';
    var select = $('.field_filter_select', elem);
    var keys = Object.keys(index);
    var counts = {};
    $.each(keys, function(idx, key){ counts[key] = Object.count(index[key]); });
    keys = keys.sort(function(a,b) {return ((counts[a] < counts[b]) ? 1 : -1) ;});
    var checkmark = '* '; //has to be not part of a regex
    get_option_name_for_key = function(key, counts, checked) {
      if (key==null_key) return '- '+title+' -';
      return (checked ? checkmark:'' ) + ((key=='') ? '- not specified -' : key ) + ' ('+counts[key]+')';
    }
    select.append('<option value="'+null_key+'">'+get_option_name_for_key(null_key, counts)+'</option>');
    $.each(keys, function(idx, key) {
      select.append('<option value="'+key+'">'+get_option_name_for_key(key, counts)+'</option>');
    });

    //attach our actions

    //filter values
    var current_values_display = $('.field_filter_current_values', elem);
    var populate_current_values_display = function() {
      var selected = Object.keys(APPLICATION.current_search_params[field_name] || {});
      current_values_display.html('');
      $.each(selected, function(idx, selected_val) {
        var elem = $('<div class="field_selected_value"/>')
        elem.text(selected_val == '' ? 'unspecified' : selected_val);
        elem.click(function(){
          select.val(selected_val);
          select.change();
        });
        current_values_display.append(elem);
        current_values_display.append(' ');        
      });
      APPLICATION.do_search();
    };
    //clear button
    var clear_button = $('.field_filter_clear', elem);
    clear_button.click(function(){ 
      //clear the checkmarks out of the selector
      $.each($('option', select), function(idx, elem){
        elem = $(elem);
        var key = elem.attr('value');
        if (key != null_key)
          elem.text(get_option_name_for_key(key, counts));
      });
      //clear the index
      APPLICATION.remove_search_filter(field_name);
      //populate_current_values_display
      populate_current_values_display();
    });
    //selector
    select.change(function() {
      //get the selected option and value
      var selected_option = $('option:selected', select);
      var selected_value = selected_option.attr('value');
      //ignore jump to top of list
      if (selected_value == null_key) return;
      //add or remove the checkmark
      var was_checked = APPLICATION.current_search_params[field_name] && APPLICATION.current_search_params[field_name][selected_value];
      selected_option.text(get_option_name_for_key(selected_value, counts, was_checked ? false : true));
      //add ore remove the search term
      if (was_checked) APPLICATION.remove_search_filter(field_name, selected_value);
      else APPLICATION.add_search_filter(field_name, selected_value);
      //populate_current_values_display
      populate_current_values_display();
      //jump to the top of the lsit
      select.val(null_key);
    });
    
  }
}; return self;})();
$.widget("ui.friend_filter_widget", FriendFilterWidget);


//we let the browser take care of clever caching of profile photos


/////////////////////////////////////////////////////
// SELECTOR WIDGET

//clever adapt US states
//current state
//hometown state

/////////////////////////////////////////////////////
// UTIL

//internationalization-safe capitalization of strings
String.prototype.capitalize = String.prototype.capitalize || function() {
  return this.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
};
//only accepts things that can be used as array keys, e.g. numbers or strings
// from http://www.shamasis.net/2009/09/fast-algorithm-to-find-unique-items-in-javascript-array/
Array.prototype.unique = Array.prototype.unique || function() {
  var o = {}, i, l = this.length, r = [];
  for(var i=0; i<l;i+=1) o[this[i]] = this[i];
  for(i in o) r.push(o[i]);
  return r;
};
//get the count of properties of the object -- e.g. ({foo:1,bar:2}).count() => 2
//you can do this with 
Object.count = Object.count || function(obj) {
  if (obj.length) return obj.length;
  return Object.keys(obj).length;
}
//easy array removal
Array.prototype.removeIndex = Array.prototype.removeIndex || function(idx) {
  this.splice(idx, 1); return this;
}
Array.prototype.removeValue = Array.prototype.removeValue || function(val, allowFuzzyEquality) {
  for (var i=this.length-1; i<=0; i--)
    if (this[i] === val || allowFuzzyEquality && this[i] == val)
      this.splice(idx, 1);
}
$.merge_all = function(args) {
  for (var i=0; i<args.length; i++)
    $.merge(args[0], args[i]);
  return args[0];
}
jQuery.fn.reverse = [].reverse;

UTIL = window.UTIL || {};
UTIL.state_abbrs = ({"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE",
"District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
"Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Marshall Islands":"MH","Maryland":"MD","Massachusetts":"MA","Michigan":"MI",
"Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
"New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA",
"Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA",
"Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"});


$().ready(function(){
  if (FACEBOOK.parse_token())
    APPLICATION.load(0);
});


})();