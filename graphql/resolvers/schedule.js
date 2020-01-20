const { PubSub } = require('apollo-server-express');
const Schedule = require('../../models/schedule');
const User = require('../../models/user');
const Workout = require('../../models/workout');
const Notification = require('../../models/notification');
const WorkoutResolver = require('../../graphql/resolvers/workout').Workout;

const { sendMail } = require('../../helpers/helpers');

const { createWorkoutDL: WorkoutDataLoader } = require('../dataloaders/workout');

const pubsub = new PubSub();
const SCHEDULED_WORKOUTS = 'scheduledWorkoutAlerts';

const sendNotification = (notification) => {
  if (notification.topic.includes('Workout')) {
    pubsub.publish(SCHEDULED_WORKOUTS, {
      scheduledWorkoutAlert: { ...notification._doc, id: notification.id }
    });
  }
};

module.exports = {
  Query: {
    userSchedule: async (_, args, context) => {
      const userId = context.user.id;
      let calendarStart = new Date().setHours(0, 0, 0, 0);
      calendarStart = new Date(calendarStart).setMonth(new Date(calendarStart).getMonth() - 3);
      let calendarEnd = new Date().setHours(0, 0, 0, 0);
      calendarEnd = new Date(calendarEnd).setMonth(new Date(calendarEnd).getMonth() + 3);
      const userSchedule = await Schedule.find({
        userId,
        $or: [
          { startDate: { $gt: calendarStart, $lt: calendarEnd } },
          { routine: 'daily' },
          { routine: 'weekly' }
        ]
      }).sort({ startDate: 'asc' });
      const response = [];
      for (
        let day = new Date(calendarStart);
        day < new Date(calendarEnd);
        day.setDate(new Date(day).getDate() + 1)
      ) {
        const dayTime = day.getTime();
        const dayOfWeek = new Date(dayTime).getDay();
        const nextDay = new Date(dayTime).setDate(new Date(dayTime).getDate() + 1);
        userSchedule.forEach((schedule) => {
          const scheduleDate = new Date(schedule.startDate);
          const sDate = {
            h: scheduleDate.getHours(),
            m: scheduleDate.getMinutes(),
            s: scheduleDate.getSeconds(),
            ms: scheduleDate.getMilliseconds(),
          };
          if ((
            schedule.routine === 'daily'
            || (schedule.routine === 'weekly' && scheduleDate.getDay() === dayOfWeek))
            && schedule.startDate < dayTime
          ) {
            response.push({
              ...schedule._doc,
              id: schedule.id,
              startDate: new Date(day).setHours(sDate.h, sDate.m, sDate.s, sDate.ms)
            });
          } else if (schedule.routine === 'monthly') {
            if (new Date(schedule.startDate).getDate() === new Date(dayTime).getDate()) {
              response.push({
                ...schedule._doc,
                id: schedule.id,
                startDate: new Date(schedule.startDate)
                  .setMonth(new Date(dayTime).getMonth())
              });
            }
          } else if (schedule.startDate >= dayTime && schedule.startDate < nextDay) {
            response.push(schedule);
          }
        });
      }
      return response;
    },
    suggestionsByExperience: async (_, args, context) => {
      const userId = context.user.id;
      const user = await User.findById(userId);
      const workouts = await Workout.find();
      const workoutsExperience = await Promise.all(workouts.map(
        (workout) => WorkoutResolver.experience(workout, null, context)
      ));
      return workouts.map((workout, index) => ({
        ...workout._doc,
        id: workout.id,
        experience: workoutsExperience[index]
      })).filter((workout) => workout.experience === user.experience);
    }
  },
  Mutation: {
    pushNotification: async (_, { input: { userId, message, topic } }) => {
      const user = await User.findById(userId);
      console.log(user);
      const schedule = await Schedule.find({ userId });
      console.log(schedule);
      let newNotification = new Notification({
        userId,
        message,
        topic,
        type: user.reminderType
      });
      newNotification = await newNotification.save();
      // schedule.map(session => {
      // if(session.startDate === newNotification.reminderTime + Date.parse(new Date())) {
      if (user.reminderType === 'notification') {
        sendNotification(newNotification);
      } else {
        await sendMail(newNotification, user);
      }
      return newNotification;
      // }
      // })
    },
    scheduleWorkout: async (_, {
      input: {
        workoutId, startDate, reminderTime, routine
      }
    }, context) => {
      const userId = context.user.id;
      let schedule = new Schedule({
        workoutId, startDate, reminderTime, routine, userId
      });
      schedule = await schedule.save();
      return schedule;
    }
  },
  Subscription: {
    scheduledWorkoutAlert: {
      subscribe: () => {
        console.log(SCHEDULED_WORKOUTS);
        return pubsub.asyncIterator(SCHEDULED_WORKOUTS);
      }
    }
  },
  Schedule: {
    workoutId: (schedule, args, context) => WorkoutDataLoader(context).load(schedule.workoutId)
  }
};
