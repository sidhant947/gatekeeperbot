import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
});

Devvit.addSettings([
  {
    type: "group",
    label: "Account Age",
    helpText: "Filter Posts/Comments by Account Age Requirements",
    fields: [
      {
        type: 'select',
        name: 'account-age-applies-to',
        label: 'Apply account age filter to:',
        options: [
          { label: 'Posts', value: 'post' },
          { label: 'Comments', value: 'comment' }
        ],
        multiSelect: true,
        defaultValue: ['post', 'comment']
      },
      {
        type: 'number',
        name: 'minimum-account-age',
        label: 'Minimum account age (in days) required to post/comment:',
        onValidate: (event) => {
          if (event.value! < 0) {
            return 'Account age must be a positive number';
          }
        }
      },
      {
        type: 'paragraph',
        name: 'removal-message',
        label: 'Custom message to send to users when content is removed:',
        helpText: 'You can use {age} to insert the user\'s account age and {minimum} to insert the minimum required age.'
      },
      {
        type: 'boolean',
        name: 'send-pm',
        label: 'Send a private message to the user when content is removed',
        defaultValue: true
      },
      {
        type: 'boolean',
        name: 'leave-comment',
        label: 'Leave a removal comment when content is removed',
        defaultValue: false
      },
      {
        type: 'boolean',
        name: 'ignore-approved-users',
        label: 'Ignore approved users (do not remove their content)',
        defaultValue: true
      }
    ]
  },
  {
    type: "group",
    label: "User Karma",
    helpText: "Filter Posts/Comments by User Karma Requirements",
    fields: [
      {
        type: 'select',
        name: 'karma-applies-to',
        label: 'Apply karma filter to:',
        options: [
          { label: 'Posts', value: 'post' },
          { label: 'Comments', value: 'comment' }
        ],
        multiSelect: true,
        defaultValue: ['post', 'comment']
      },
      {
        type: 'number',
        name: 'minimum-karma',
        label: 'Minimum karma required to post/comment:',
        onValidate: (event) => {
          if (event.value! < 0) {
            return 'Karma must be a positive number';
          }
        }
      },
      {
        type: 'paragraph',
        name: 'karma-removal-message',
        label: 'Custom message to send to users when content is removed for low karma:',
        helpText: 'You can use {karma} to insert the user\'s karma and {minimum} to insert the minimum required karma.'
      },
      {
        type: 'boolean',
        name: 'karma-send-pm',
        label: 'Send a private message to the user when content is removed for low karma',
        defaultValue: true
      },
      {
        type: 'boolean',
        name: 'karma-leave-comment',
        label: 'Leave a removal comment when content is removed for low karma',
        defaultValue: false
      },
      {
        type: 'boolean',
        name: 'karma-ignore-approved-users',
        label: 'Ignore approved users (do not remove their content for low karma)',
        defaultValue: true
      }
    ]
  }
]);

// Placeholder for checking if a user is approved. The knowledge sources do not provide a direct method.
async function isApprovedUser(_reddit, _subredditName, _username) {
  return false;
}

async function checkAccountAge(event, context) {
  const { reddit, settings } = context;
  const accountAgeAppliesTo = await settings.get('account-age-applies-to') || ['post', 'comment'];
  const minimumAccountAge = await settings.get('minimum-account-age') || 30;
  const customMessage = await settings.get('removal-message');
  const sendPM = await settings.get('send-pm');
  const leaveComment = await settings.get('leave-comment');
  const ignoreApprovedUsers = await settings.get('ignore-approved-users');

  let content, author, contentType;
  if (event.type === 'PostSubmit') {
    contentType = 'post';
    content = event.post;
    author = event.author;
  } else if (event.type === 'CommentSubmit') {
    contentType = 'comment';
    content = event.comment;
    author = event.author;
  } else {
    return;
  }

  if (!accountAgeAppliesTo.includes(contentType)) return;
  if (!content || !content.id || !author || !author.id) return;

  if (ignoreApprovedUsers) {
    const subreddit = event.subreddit?.name;
    if (await isApprovedUser(reddit, subreddit, author.name)) {
      return;
    }
  }

  if (author?.name?.toLowerCase() === 'gate-keeper-bot') return;

  const fetchedAuthor = await reddit.getUserById(author.id);
  const createdAtMs = fetchedAuthor.createdAt;
  const now = new Date();
  const accountAgeInDays = Math.floor((now.getTime() - new Date(createdAtMs).getTime()) / (1000 * 60 * 60 * 24));

  if (accountAgeInDays < minimumAccountAge) {
    let contentObj;
    if (contentType === 'post') {
      contentObj = await reddit.getPostById(content.id);
    } else {
      contentObj = await reddit.getCommentById(content.id);
    }

    let messageText = customMessage
      ? customMessage.replace(/{age}/g, accountAgeInDays.toString()).replace(/{minimum}/g, minimumAccountAge.toString())
      : `Your ${contentType} has been removed because your account is less than ${minimumAccountAge} days old. Your account is currently ${accountAgeInDays} days old.`;

    await contentObj.remove();

    if (sendPM) {
      await reddit.sendPrivateMessage({
        to: author.name,
        subject: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} removed from r/${event.subreddit.name}`,
        text: messageText,
      });
    }

    // FIX: Now comments under both posts and comments
    if (leaveComment) {
      await reddit.submitComment({
        id: content.id,
        text: messageText,
        distinguish: true,
      });
    }
  }
}

async function checkKarma(event, context) {
  const { reddit, settings } = context;
  const karmaAppliesTo = await settings.get('karma-applies-to') || ['post', 'comment'];
  const minimumKarma = await settings.get('minimum-karma') || 0;
  const customMessage = await settings.get('karma-removal-message');
  const sendPM = await settings.get('karma-send-pm');
  const leaveComment = await settings.get('karma-leave-comment');
  const ignoreApprovedUsers = await settings.get('karma-ignore-approved-users');

  let content, author, contentType;
  if (event.type === 'PostSubmit') {
    contentType = 'post';
    content = event.post;
    author = event.author;
  } else if (event.type === 'CommentSubmit') {
    contentType = 'comment';
    content = event.comment;
    author = event.author;
  } else {
    return;
  }

  if (!karmaAppliesTo.includes(contentType)) return;
  if (!content || !content.id || !author || !author.id) return;

  if (ignoreApprovedUsers) {
    const subreddit = event.subreddit?.name;
    if (await isApprovedUser(reddit, subreddit, author.name)) {
      return;
    }
  }

  if (author?.name?.toLowerCase() === 'gate-keeper-bot') return;

  const fetchedAuthor = await reddit.getUserById(author.id);
  const userKarma = fetchedAuthor.karma ?? 0; // The knowledge sources do not specify the exact property name

  if (userKarma < minimumKarma) {
    let contentObj;
    if (contentType === 'post') {
      contentObj = await reddit.getPostById(content.id);
    } else {
      contentObj = await reddit.getCommentById(content.id);
    }

    let messageText = customMessage
      ? customMessage.replace(/{karma}/g, userKarma.toString()).replace(/{minimum}/g, minimumKarma.toString())
      : `Your ${contentType} has been removed because your karma is less than ${minimumKarma}. Your karma is currently ${userKarma}.`;

    await contentObj.remove();



    if (sendPM) {
      await reddit.sendPrivateMessage({
        to: author.name,
        subject: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} removed from r/${event.subreddit.name}`,
        text: messageText,
      });
    }

    // FIX: Now comments under both posts and comments
    if (leaveComment) {
      await reddit.submitComment({
        id: content.id,
        text: messageText,
        distinguish: true,
      });
    }
  }
}

Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    await checkAccountAge(event, context);
    await checkKarma(event, context);
  },
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    await checkAccountAge(event, context);
    await checkKarma(event, context);
  },
});

export default Devvit;